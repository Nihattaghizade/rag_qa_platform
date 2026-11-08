import asyncio
import uuid
from uuid import UUID

from app.clients.qdrant_client import delete_file_vectors
from app.clients.redis_client import is_file_cancelled, publish_file_progress
from app.clients.s3_client import download_s3_object_bytes
from app.db.session import get_tenant_db_session
from app.models.entities import DocumentChunk
from app.rag.document_parser import StreamingDocumentParser
from app.rag.hybrid_chunker import ThreeStageHybridChunker
from app.repositories.file_repo import FileRepository
from app.workers.celery_app import celery_app
from app.workers.embedding_worker import embed_and_index_chunks_task


async def _check_aborted(user_id: UUID, file_id: UUID) -> bool:
    if await is_file_cancelled(str(file_id)):
        return True
    async with get_tenant_db_session(user_id) as session:
        repo = FileRepository(session)
        rec = await repo.get_by_id(user_id=user_id, file_id=file_id)
        return rec is None


async def _run_parse_and_chunk(user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    user_id = UUID(user_id_str)
    file_id = UUID(file_id_str)

    if await _check_aborted(user_id, file_id):
        return {"file_id": file_id_str, "status": "ABORTED"}

    async with get_tenant_db_session(user_id) as session:
        repo = FileRepository(session)
        file_rec = await repo.get_by_id(user_id=user_id, file_id=file_id)
        if not file_rec:
            return {"file_id": file_id_str, "status": "ABORTED"}

        filename = file_rec.filename
        mime_type = file_rec.mime_type
        s3_key = file_rec.s3_key

        await repo.update_status(file_id=file_id, status="PARSING", progress_pct=20)

    await publish_file_progress(user_id_str, file_id_str, "PARSING", 20)

    try:
        file_bytes = await asyncio.to_thread(download_s3_object_bytes, s3_key)
        if await _check_aborted(user_id, file_id):
            return {"file_id": file_id_str, "status": "ABORTED"}

        total_pages, parsed_blocks = await asyncio.to_thread(
            StreamingDocumentParser.parse_bytes, file_bytes, mime_type, filename
        )

        if await _check_aborted(user_id, file_id):
            return {"file_id": file_id_str, "status": "ABORTED"}

        async with get_tenant_db_session(user_id) as session:
            repo = FileRepository(session)
            await repo.update_status(
                file_id=file_id,
                status="CHUNKING",
                progress_pct=50,
                total_pages=total_pages,
            )
        await publish_file_progress(user_id_str, file_id_str, "CHUNKING", 50)

        chunker = ThreeStageHybridChunker()
        hierarchical_chunks = await asyncio.to_thread(chunker.chunk_document, filename, parsed_blocks)

        if await _check_aborted(user_id, file_id):
            return {"file_id": file_id_str, "status": "ABORTED"}

        db_chunks: list[DocumentChunk] = []
        for ch in hierarchical_chunks:
            db_chunks.append(
                DocumentChunk(
                    id=uuid.uuid4(),
                    file_id=file_id,
                    user_id=user_id,
                    chunk_index=ch.chunk_index,
                    page_number=ch.page_number,
                    section_heading=ch.section_heading,
                    parent_text=ch.parent_text,
                    child_text=ch.child_text,
                    token_count=ch.token_count,
                    metadata_json=ch.metadata,
                    is_deleted=0,
                )
            )

        async with get_tenant_db_session(user_id) as session:
            repo = FileRepository(session)
            if not await repo.get_by_id(user_id, file_id):
                return {"file_id": file_id_str, "status": "ABORTED"}
            await repo.bulk_insert_chunks(db_chunks)
            await repo.update_status(
                file_id=file_id,
                status="EMBEDDING",
                progress_pct=70,
                total_pages=total_pages,
                total_chunks=len(db_chunks),
            )

        await publish_file_progress(
            user_id_str, file_id_str, "EMBEDDING", 70, total_chunks=len(db_chunks)
        )

        embed_and_index_chunks_task.delay(user_id_str, file_id_str)
        return {"file_id": file_id_str, "total_pages": total_pages, "total_chunks": len(db_chunks)}

    except Exception as exc:
        if await _check_aborted(user_id, file_id):
            await asyncio.to_thread(delete_file_vectors, user_id_str, file_id_str)
            return {"file_id": file_id_str, "status": "ABORTED"}

        async with get_tenant_db_session(user_id) as session:
            repo = FileRepository(session)
            await repo.update_status(
                file_id=file_id,
                status="FAILED",
                progress_pct=0,
                error_message=str(exc)[:1000],
            )
        await publish_file_progress(
            user_id_str, file_id_str, "FAILED", 0, error_message=str(exc)[:500]
        )
        raise


@celery_app.task(
    name="app.workers.parser_worker.parse_and_chunk_document_task",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def parse_and_chunk_document_task(self, user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    return asyncio.run(_run_parse_and_chunk(user_id_str, file_id_str))
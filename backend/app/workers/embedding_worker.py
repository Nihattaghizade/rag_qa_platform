import asyncio
from uuid import UUID

from qdrant_client import models
from sqlalchemy import select

from app.clients.qdrant_client import get_qdrant_client, init_qdrant_collection
from app.clients.redis_client import publish_file_progress
from app.core.config import settings
from app.db.session import get_tenant_db_session
from app.models.entities import DocumentChunk
from app.rag.onnx_models import LocalONNXModelRegistry
from app.rag.semantic_cache import FourTierSemanticCache
from app.repositories.file_repo import FileRepository
from app.workers.celery_app import celery_app


async def _run_embed_and_index(user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    user_id = UUID(user_id_str)
    file_id = UUID(file_id_str)

    try:
        await asyncio.to_thread(init_qdrant_collection)

        async with get_tenant_db_session(user_id) as session:
            stmt = (
                select(DocumentChunk)
                .where(DocumentChunk.file_id == file_id, DocumentChunk.user_id == user_id)
                .order_by(DocumentChunk.chunk_index.asc())
            )
            res = await session.execute(stmt)
            chunks = list(res.scalars().all())

        if not chunks:
            async with get_tenant_db_session(user_id) as session:
                repo = FileRepository(session)
                await repo.update_status(file_id=file_id, status="READY", progress_pct=100, total_chunks=0)
            await publish_file_progress(user_id_str, file_id_str, "READY", 100, total_chunks=0)
            return {"file_id": file_id_str, "indexed_points": 0}

        texts = [c.child_text for c in chunks]
        dense_vectors = await asyncio.to_thread(LocalONNXModelRegistry.embed_dense_batch, texts)
        sparse_vectors = await asyncio.to_thread(LocalONNXModelRegistry.embed_sparse_batch, texts)

        points: list[models.PointStruct] = []
        for idx, chunk_obj in enumerate(chunks):
            sv = sparse_vectors[idx]
            points.append(
                models.PointStruct(
                    id=str(chunk_obj.id),
                    vector={
                        "dense": dense_vectors[idx],
                        "bm25": models.SparseVector(
                            indices=sv["indices"],
                            values=sv["values"],
                        ),
                    },
                    payload={
                        "user_id": user_id_str,
                        "file_id": file_id_str,
                        "chunk_index": chunk_obj.chunk_index,
                        "page_number": chunk_obj.page_number,
                        "section_heading": chunk_obj.section_heading or "",
                    },
                )
            )

        qdrant = get_qdrant_client()
        batch_size = 64
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            await asyncio.to_thread(
                qdrant.upsert,
                collection_name=settings.QDRANT_COLLECTION_NAME,
                points=batch,
                wait=True,
            )

        async with get_tenant_db_session(user_id) as session:
            repo = FileRepository(session)
            await repo.update_status(
                file_id=file_id,
                status="READY",
                progress_pct=100,
                total_chunks=len(points),
            )

        await FourTierSemanticCache.invalidate_user_cache(user_id)
        await publish_file_progress(
            user_id_str, file_id_str, "READY", 100, total_chunks=len(points)
        )
        return {"file_id": file_id_str, "indexed_points": len(points)}

    except Exception as exc:
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
    name="app.workers.embedding_worker.embed_and_index_chunks_task",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def embed_and_index_chunks_task(self, user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    return asyncio.run(_run_embed_and_index(user_id_str, file_id_str))
import asyncio
import json
from uuid import UUID

from qdrant_client import models
from sqlalchemy import select

from app.clients.qdrant_client import (
    delete_file_vectors,
    get_qdrant_client,
    init_qdrant_collection,
)
from app.clients.redis_client import is_file_cancelled, publish_file_progress
from app.core.config import settings
from app.db.session import get_tenant_db_session
from app.models.entities import DocumentChunk
from app.rag.onnx_models import LocalONNXModelRegistry
from app.rag.semantic_cache import FourTierSemanticCache
from app.repositories.file_repo import FileRepository
from app.workers.celery_app import celery_app

MAX_QDRANT_BATCH_BYTES = 15 * 1024 * 1024
MAX_QDRANT_BATCH_POINTS = 64


async def _is_aborted(user_id: UUID, file_id: UUID) -> bool:
    if await is_file_cancelled(str(file_id)):
        return True
    async with get_tenant_db_session(user_id) as session:
        repo = FileRepository(session)
        return (await repo.get_by_id(user_id, file_id)) is None


def _estimate_point_bytes(point: models.PointStruct) -> int:
    vector_dict = point.vector if isinstance(point.vector, dict) else {}
    dense_len = len(vector_dict.get("dense", [])) * 8
    bm25_obj = vector_dict.get("bm25")
    sparse_len = (len(getattr(bm25_obj, "indices", [])) * 12) if bm25_obj else 0
    payload_len = len(json.dumps(point.payload or {}).encode("utf-8"))
    return dense_len + sparse_len + payload_len + 256


async def _upsert_points_under_payload_limit(
    user_id: UUID,
    file_id: UUID,
    user_id_str: str,
    file_id_str: str,
    chunks: list[DocumentChunk],
) -> int | None:
    qdrant = get_qdrant_client()
    total_chunks = len(chunks)
    total_indexed = 0
    embed_window = 64

    for start_idx in range(0, total_chunks, embed_window):
        if await _is_aborted(user_id, file_id):
            await asyncio.to_thread(delete_file_vectors, user_id_str, file_id_str)
            return None

        window_chunks = chunks[start_idx : start_idx + embed_window]
        texts = [c.child_text for c in window_chunks]

        dense_vectors = await asyncio.to_thread(LocalONNXModelRegistry.embed_dense_batch, texts)
        sparse_vectors = await asyncio.to_thread(LocalONNXModelRegistry.embed_sparse_batch, texts)

        if await _is_aborted(user_id, file_id):
            await asyncio.to_thread(delete_file_vectors, user_id_str, file_id_str)
            return None

        current_batch: list[models.PointStruct] = []
        current_batch_bytes = 0

        for idx, chunk_obj in enumerate(window_chunks):
            sv = sparse_vectors[idx]
            point = models.PointStruct(
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
                    "section_heading": (chunk_obj.section_heading or "")[:256],
                },
            )
            point_bytes = _estimate_point_bytes(point)

            if current_batch and (
                current_batch_bytes + point_bytes > MAX_QDRANT_BATCH_BYTES
                or len(current_batch) >= MAX_QDRANT_BATCH_POINTS
            ):
                await asyncio.to_thread(
                    qdrant.upsert,
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    points=current_batch,
                    wait=True,
                )
                total_indexed += len(current_batch)
                current_batch = []
                current_batch_bytes = 0

            current_batch.append(point)
            current_batch_bytes += point_bytes

        if current_batch:
            await asyncio.to_thread(
                qdrant.upsert,
                collection_name=settings.QDRANT_COLLECTION_NAME,
                points=current_batch,
                wait=True,
            )
            total_indexed += len(current_batch)

        pct = min(98, 70 + int((total_indexed / max(1, total_chunks)) * 28))
        await publish_file_progress(
            user_id_str, file_id_str, "EMBEDDING", pct, total_chunks=total_chunks
        )

    return total_indexed


async def _run_embed_and_index(user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    user_id = UUID(user_id_str)
    file_id = UUID(file_id_str)

    try:
        if await _is_aborted(user_id, file_id):
            return {"file_id": file_id_str, "status": "ABORTED"}

        await asyncio.to_thread(init_qdrant_collection)

        async with get_tenant_db_session(user_id) as session:
            stmt = (
                select(DocumentChunk)
                .where(
                    DocumentChunk.file_id == file_id,
                    DocumentChunk.user_id == user_id,
                    DocumentChunk.is_deleted == 0,
                )
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

        indexed_count = await _upsert_points_under_payload_limit(
            user_id=user_id,
            file_id=file_id,
            user_id_str=user_id_str,
            file_id_str=file_id_str,
            chunks=chunks,
        )

        if indexed_count is None:
            return {"file_id": file_id_str, "status": "ABORTED"}

        async with get_tenant_db_session(user_id) as session:
            repo = FileRepository(session)
            await repo.update_status(
                file_id=file_id,
                status="READY",
                progress_pct=100,
                total_chunks=indexed_count,
            )

        await FourTierSemanticCache.invalidate_user_cache(user_id)
        await publish_file_progress(
            user_id_str, file_id_str, "READY", 100, total_chunks=indexed_count
        )
        return {"file_id": file_id_str, "indexed_points": indexed_count}

    except Exception as exc:
        if await _is_aborted(user_id, file_id):
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
    name="app.workers.embedding_worker.embed_and_index_chunks_task",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def embed_and_index_chunks_task(self, user_id_str: str, file_id_str: str) -> dict[str, int | str]:
    return asyncio.run(_run_embed_and_index(user_id_str, file_id_str))
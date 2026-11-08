from dataclasses import dataclass
from uuid import UUID

from qdrant_client import models
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.qdrant_client import get_qdrant_client
from app.core.config import settings
from app.rag.onnx_models import LocalONNXModelRegistry
from app.repositories.file_repo import FileRepository


@dataclass
class RetrievedContextChunk:
    chunk_id: UUID
    file_id: UUID
    filename: str
    page_number: int
    section_heading: str | None
    parent_text: str
    child_text: str
    rerank_score: float


class TwoStageHybridRetriever:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session
        self.file_repo = FileRepository(db_session)
        self.qdrant = get_qdrant_client()

    async def retrieve(
        self,
        user_id: UUID,
        query: str,
        scoped_file_ids: list[UUID] | None = None,
        prefetch_limit: int = 25,
        top_k: int = 6,
    ) -> list[RetrievedContextChunk]:
        dense_vec = LocalONNXModelRegistry.embed_dense_batch([query])[0]
        sparse_vec = LocalONNXModelRegistry.embed_sparse_batch([query])[0]

        must_conditions: list[models.Condition] = [
            models.FieldCondition(
                key="user_id",
                match=models.MatchValue(value=str(user_id)),
            )
        ]
        if scoped_file_ids:
            must_conditions.append(
                models.FieldCondition(
                    key="file_id",
                    match=models.MatchAny(any=[str(fid) for fid in scoped_file_ids]),
                )
            )

        tenant_filter = models.Filter(must=must_conditions)

        search_result = self.qdrant.query_points(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            prefetch=[
                models.Prefetch(
                    query=dense_vec,
                    using="dense",
                    filter=tenant_filter,
                    limit=prefetch_limit,
                ),
                models.Prefetch(
                    query=models.SparseVector(
                        indices=sparse_vec["indices"],
                        values=sparse_vec["values"],
                    ),
                    using="bm25",
                    filter=tenant_filter,
                    limit=prefetch_limit,
                ),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=prefetch_limit,
            with_payload=True,
        )

        points = search_result.points
        if not points:
            return []

        candidate_ids = [UUID(str(p.id)) for p in points]
        db_chunks = await self.file_repo.get_chunks_by_ids(user_id=user_id, chunk_ids=candidate_ids)
        chunk_map = {c.id: c for c in db_chunks}

        ordered_chunks = [chunk_map[cid] for cid in candidate_ids if cid in chunk_map]
        if not ordered_chunks:
            return []

        candidate_texts = [c.child_text for c in ordered_chunks]
        rerank_scores = LocalONNXModelRegistry.rerank_pairs(query, candidate_texts)

        scored_pairs = sorted(
            zip(ordered_chunks, rerank_scores),
            key=lambda item: item[1],
            reverse=True,
        )[:top_k]

        results: list[RetrievedContextChunk] = []
        seen_parents: set[str] = set()

        for chunk_obj, score in scored_pairs:
            dedup_key = f"{chunk_obj.file_id}:{hash(chunk_obj.parent_text)}"
            if dedup_key in seen_parents:
                continue
            seen_parents.add(dedup_key)
            filename = str(chunk_obj.metadata_json.get("filename", "Document"))
            results.append(
                RetrievedContextChunk(
                    chunk_id=chunk_obj.id,
                    file_id=chunk_obj.file_id,
                    filename=filename,
                    page_number=chunk_obj.page_number,
                    section_heading=chunk_obj.section_heading,
                    parent_text=chunk_obj.parent_text,
                    child_text=chunk_obj.child_text,
                    rerank_score=round(float(score), 4),
                )
            )

        return results
import hashlib
import json
from typing import Any
from uuid import UUID

import numpy as np

from app.clients.redis_client import get_redis_client
from app.rag.onnx_models import LocalONNXModelRegistry


class FourTierSemanticCache:
    SIMILARITY_THRESHOLD = 0.93
    CACHE_TTL_SECONDS = 3600

    @classmethod
    def _scope_fingerprint(cls, user_id: UUID, scoped_file_ids: list[UUID] | None) -> str:
        sorted_ids = sorted(str(fid) for fid in (scoped_file_ids or []))
        raw = f"{user_id}:{'|'.join(sorted_ids)}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    @classmethod
    def _exact_key(cls, scope_fp: str, query: str) -> str:
        norm_q = " ".join(query.lower().strip().split())
        q_hash = hashlib.sha256(norm_q.encode("utf-8")).hexdigest()
        return f"rag:cache:exact:{scope_fp}:{q_hash}"

    @classmethod
    def _semantic_list_key(cls, scope_fp: str) -> str:
        return f"rag:cache:sem:{scope_fp}"

    @classmethod
    async def get_cached_response(
        cls,
        user_id: UUID,
        query: str,
        scoped_file_ids: list[UUID] | None = None,
    ) -> dict[str, Any] | None:
        redis = get_redis_client()
        scope_fp = cls._scope_fingerprint(user_id, scoped_file_ids)

        exact_key = cls._exact_key(scope_fp, query)
        exact_hit = await redis.get(exact_key)
        if exact_hit:
            return json.loads(exact_hit)

        sem_key = cls._semantic_list_key(scope_fp)
        entries = await redis.lrange(sem_key, 0, 29)
        if not entries:
            return None

        q_vec = np.array(LocalONNXModelRegistry.embed_dense_batch([query])[0], dtype=np.float32)
        q_norm = q_vec / (np.linalg.norm(q_vec) + 1e-10)

        for raw_entry in entries:
            item = json.loads(raw_entry)
            cached_vec = np.array(item["vec"], dtype=np.float32)
            sim = float(np.dot(q_norm, cached_vec))
            if sim >= cls.SIMILARITY_THRESHOLD:
                return item["payload"]

        return None

    @classmethod
    async def set_cached_response(
        cls,
        user_id: UUID,
        query: str,
        scoped_file_ids: list[UUID] | None,
        response_payload: dict[str, Any],
    ) -> None:
        redis = get_redis_client()
        scope_fp = cls._scope_fingerprint(user_id, scoped_file_ids)

        exact_key = cls._exact_key(scope_fp, query)
        await redis.set(exact_key, json.dumps(response_payload), ex=cls.CACHE_TTL_SECONDS)

        q_vec = np.array(LocalONNXModelRegistry.embed_dense_batch([query])[0], dtype=np.float32)
        q_norm = (q_vec / (np.linalg.norm(q_vec) + 1e-10)).tolist()

        sem_key = cls._semantic_list_key(scope_fp)
        entry = json.dumps({"vec": q_norm, "payload": response_payload})
        await redis.lpush(sem_key, entry)
        await redis.ltrim(sem_key, 0, 29)
        await redis.expire(sem_key, cls.CACHE_TTL_SECONDS)

    @classmethod
    async def invalidate_user_cache(cls, user_id: UUID) -> None:
        redis = get_redis_client()
        scope_fp = cls._scope_fingerprint(user_id, None)
        sem_key = cls._semantic_list_key(scope_fp)
        await redis.delete(sem_key)
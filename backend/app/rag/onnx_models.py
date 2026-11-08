import os
from typing import Any

import numpy as np

from app.core.config import settings

os.environ["OMP_NUM_THREADS"] = str(settings.OMP_NUM_THREADS)
os.environ["MKL_NUM_THREADS"] = str(settings.MKL_NUM_THREADS)
os.environ["OPENBLAS_NUM_THREADS"] = str(settings.OPENBLAS_NUM_THREADS)
os.environ["TOKENIZERS_PARALLELISM"] = settings.TOKENIZERS_PARALLELISM

from fastembed import SparseTextEmbedding, TextEmbedding
from fastembed.rerank.cross_encoder import TextCrossEncoder


class LocalONNXModelRegistry:
    _dense_model: TextEmbedding | None = None
    _sparse_model: SparseTextEmbedding | None = None
    _reranker_model: TextCrossEncoder | None = None

    @classmethod
    def get_dense_model(cls) -> TextEmbedding:
        if cls._dense_model is None:
            cls._dense_model = TextEmbedding(
                model_name=settings.LOCAL_EMBEDDING_MODEL,
                threads=settings.OMP_NUM_THREADS,
            )
        return cls._dense_model

    @classmethod
    def get_sparse_model(cls) -> SparseTextEmbedding:
        if cls._sparse_model is None:
            cls._sparse_model = SparseTextEmbedding(
                model_name=settings.LOCAL_SPARSE_MODEL,
                threads=settings.OMP_NUM_THREADS,
            )
        return cls._sparse_model

    @classmethod
    def get_reranker_model(cls) -> TextCrossEncoder:
        if cls._reranker_model is None:
            cls._reranker_model = TextCrossEncoder(
                model_name=settings.LOCAL_RERANKER_MODEL,
                threads=settings.OMP_NUM_THREADS,
            )
        return cls._reranker_model

    @classmethod
    def embed_dense_batch(cls, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = cls.get_dense_model()
        embeddings = list(model.embed(texts, batch_size=32))
        return [vec.tolist() if isinstance(vec, np.ndarray) else list(vec) for vec in embeddings]

    @classmethod
    def embed_sparse_batch(cls, texts: list[str]) -> list[dict[str, list[Any]]]:
        if not texts:
            return []
        model = cls.get_sparse_model()
        sparse_vecs = list(model.embed(texts, batch_size=32))
        results: list[dict[str, list[Any]]] = []
        for sv in sparse_vecs:
            results.append(
                {
                    "indices": sv.indices.tolist(),
                    "values": sv.values.tolist(),
                }
            )
        return results

    @classmethod
    def rerank_pairs(cls, query: str, documents: list[str]) -> list[float]:
        if not documents:
            return []
        reranker = cls.get_reranker_model()
        scores = list(reranker.rerank(query, documents, batch_size=16))
        return [float(s) for s in scores]
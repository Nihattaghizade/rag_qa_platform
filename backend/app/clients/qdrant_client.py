from qdrant_client import QdrantClient, models

from app.core.config import settings

_qdrant_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            grpc_port=settings.QDRANT_GRPC_PORT,
            prefer_grpc=False,
            timeout=30,
        )
    return _qdrant_client


def init_qdrant_collection() -> None:
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    existing = [c.name for c in client.get_collections().collections]
    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config={
                "dense": models.VectorParams(
                    size=settings.LOCAL_EMBEDDING_DIM,
                    distance=models.Distance.COSINE,
                    on_disk=True,
                )
            },
            sparse_vectors_config={
                "bm25": models.SparseVectorParams(
                    modifier=models.Modifier.IDF,
                )
            },
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    quantile=0.99,
                    always_ram=True,
                )
            ),
            hnsw_config=models.HnswConfigDiff(
                m=0,
                payload_m=16,
                ef_construct=100,
            ),
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="user_id",
            field_schema=models.KeywordIndexParams(
                type=models.KeywordIndexType.KEYWORD,
                is_tenant=True,
            ),
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="file_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )


def delete_file_vectors(user_id: str, file_id: str) -> None:
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id)),
                    models.FieldCondition(key="file_id", match=models.MatchValue(value=file_id)),
                ]
            )
        ),
    )


def delete_user_vectors(user_id: str) -> None:
    client = get_qdrant_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id)),
                ]
            )
        ),
    )
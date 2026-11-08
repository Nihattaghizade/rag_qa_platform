from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    APP_NAME: str = "Enterprise RAG QA Platform"
    API_V1_PREFIX: str = "/api/v1"

    JWT_SECRET_KEY: str = "change_this_to_a_64_char_random_hex_secret_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    POSTGRES_USER: str = "rag_admin"
    POSTGRES_PASSWORD: str = "rag_super_secret_password_2026"
    POSTGRES_DB: str = "enterprise_rag"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    PGBOUNCER_PORT: int = 6432
    DATABASE_URL: str = "postgresql+asyncpg://rag_admin:rag_super_secret_password_2026@localhost:5432/enterprise_rag"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_TOPIC_INGEST_RAW: str = "doc.ingest.raw"
    KAFKA_TOPIC_INGEST_CHUNKED: str = "doc.ingest.chunked"
    KAFKA_TOPIC_INGEST_DLQ: str = "doc.ingest.dlq"

    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_PUBLIC_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin_secret_2026"
    S3_BUCKET_NAME: str = "enterprise-rag-docs"
    S3_REGION: str = "us-east-1"

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_COLLECTION_NAME: str = "enterprise_rag_chunks"

    OPENAI_API_KEY: str = ""
    OPENAI_DEFAULT_MODEL: str = "gpt-4o-mini"
    OPENAI_COMPLEX_MODEL: str = "gpt-4o"

    LOCAL_EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    LOCAL_EMBEDDING_DIM: int = 384
    LOCAL_SPARSE_MODEL: str = "Qdrant/bm25"
    LOCAL_RERANKER_MODEL: str = "BAAI/bge-reranker-base"
    OMP_NUM_THREADS: int = 1
    MKL_NUM_THREADS: int = 1
    OPENBLAS_NUM_THREADS: int = 1
    TOKENIZERS_PARALLELISM: str = "false"

    PARSER_WORKERS: int = 1
    EMBEDDING_WORKERS: int = 1
    CHAT_WORKERS: int = 1
    MAINTENANCE_WORKERS: int = 1


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Enterprise RAG QA Platform"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    POSTGRES_USER: str = "rag_admin"
    POSTGRES_PASSWORD: str = "rag_secret_pass_2026"
    POSTGRES_DB: str = "enterprise_rag"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5435

    PGBOUNCER_HOST: str = "127.0.0.1"
    PGBOUNCER_PORT: int = 6432
    USE_PGBOUNCER: bool = False

    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6385
    REDIS_DB: int = 0

    KAFKA_BOOTSTRAP_SERVERS: str = "127.0.0.1:9092"
    KAFKA_INGESTION_TOPIC: str = "rag.file.ingestion"

    S3_ENDPOINT_URL: str = "http://127.0.0.1:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin123"
    S3_BUCKET_NAME: str = "rag-documents"
    S3_REGION: str = "us-east-1"

    QDRANT_HOST: str = "127.0.0.1"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_COLLECTION_NAME: str = "enterprise_rag_chunks"

    JWT_SECRET_KEY: str = "1229ffead95930b8abcc7572e29effd7e2d346a345945915be3414b358827f71"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_FAST: str = "gpt-4o-mini"
    OPENAI_MODEL_REASONING: str = "gpt-4o"

    EMBEDDING_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = 384
    SPARSE_MODEL_NAME: str = "Qdrant/bm25"
    RERANKER_MODEL_NAME: str = "BAAI/bge-reranker-base"
    OMP_NUM_THREADS: int = 1

    DEFAULT_MAX_FILES_PER_USER: int = 3
    DEFAULT_MAX_QUESTIONS_PER_USER: int = 10

    @property
    def async_database_url(self) -> str:
        host = self.PGBOUNCER_HOST if self.USE_PGBOUNCER else self.POSTGRES_HOST
        port = self.PGBOUNCER_PORT if self.USE_PGBOUNCER else self.POSTGRES_PORT
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{host}:{port}/{self.POSTGRES_DB}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
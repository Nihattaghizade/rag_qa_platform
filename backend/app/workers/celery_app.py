from celery import Celery
from kombu import Queue

from app.core.config import settings

celery_app = Celery(
    "enterprise_rag_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.parser_worker",
        "app.workers.embedding_worker",
        "app.workers.chat_worker",
        "app.workers.maintenance_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_queues=(
        Queue("q_parser"),
        Queue("q_embedding"),
        Queue("q_chat"),
        Queue("q_maintenance"),
    ),
    task_routes={
        "app.workers.parser_worker.parse_and_chunk_document_task": {"queue": "q_parser"},
        "app.workers.embedding_worker.embed_and_index_chunks_task": {"queue": "q_embedding"},
        "app.workers.chat_worker.process_chat_turn_task": {"queue": "q_chat"},
        "app.workers.maintenance_worker.update_chat_summary_task": {"queue": "q_maintenance"},
    },
)
import asyncio
import json

from aiokafka import AIOKafkaConsumer

from app.core.config import settings
from app.workers.parser_worker import parse_and_chunk_document_task


async def consume_ingest_events() -> None:
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC_INGEST_RAW,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="rag_ingest_parser_group",
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )
    await consumer.start()
    try:
        async for msg in consumer:
            payload = msg.value
            user_id = payload.get("user_id")
            file_id = payload.get("file_id")
            if user_id and file_id:
                parse_and_chunk_document_task.delay(str(user_id), str(file_id))
    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(consume_ingest_events())
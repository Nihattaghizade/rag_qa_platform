import json
from typing import Any

from aiokafka import AIOKafkaProducer

from app.core.config import settings

_producer: AIOKafkaProducer | None = None


async def get_kafka_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            enable_idempotence=True,
        )
        await _producer.start()
    return _producer


async def close_kafka_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None


async def publish_kafka_event(topic: str, key: str, payload: dict[str, Any]) -> None:
    producer = await get_kafka_producer()
    await producer.send_and_wait(topic=topic, key=key, value=payload)
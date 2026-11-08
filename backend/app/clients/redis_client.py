import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings


def get_redis_client() -> aioredis.Redis:
    return aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )


async def mark_file_cancelled(file_id: str) -> None:
    client = get_redis_client()
    try:
        await client.set(f"file:cancel:{file_id}", "1", ex=3600)
    finally:
        await client.aclose()


async def is_file_cancelled(file_id: str) -> bool:
    client = get_redis_client()
    try:
        val = await client.get(f"file:cancel:{file_id}")
        return val == "1"
    finally:
        await client.aclose()


async def register_file_task(file_id: str, task_id: str) -> None:
    client = get_redis_client()
    try:
        await client.sadd(f"file:tasks:{file_id}", task_id)
        await client.expire(f"file:tasks:{file_id}", 3600)
    finally:
        await client.aclose()


async def get_file_tasks(file_id: str) -> list[str]:
    client = get_redis_client()
    try:
        members = await client.smembers(f"file:tasks:{file_id}")
        return list(members) if members else []
    finally:
        await client.aclose()


async def publish_file_progress(
    user_id: str,
    file_id: str,
    status: str,
    progress_pct: int,
    total_chunks: int = 0,
    error_message: str | None = None,
) -> None:
    client = get_redis_client()
    try:
        payload = {
            "file_id": file_id,
            "user_id": user_id,
            "status": status,
            "progress_pct": str(progress_pct),
            "total_chunks": str(total_chunks),
            "error_message": error_message or "",
        }
        state_key = f"file:state:{file_id}"
        stream_key = f"file:stream:{user_id}"
        await client.hset(state_key, mapping=payload)
        await client.expire(state_key, 86400)
        await client.xadd(stream_key, payload, maxlen=500, approximate=True)
        await client.expire(stream_key, 86400)
    finally:
        await client.aclose()


async def append_chat_stream_event(
    assistant_msg_id: str,
    event_type: str,
    data: dict[str, Any],
) -> str:
    client = get_redis_client()
    try:
        stream_key = f"chat:stream:{assistant_msg_id}"
        entry_id = await client.xadd(
            stream_key,
            {"event": event_type, "data": json.dumps(data)},
            maxlen=5000,
            approximate=True,
        )
        await client.expire(stream_key, 3600)
        return entry_id
    finally:
        await client.aclose()
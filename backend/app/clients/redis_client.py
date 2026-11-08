import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=100,
    decode_responses=True,
)


def get_redis_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=redis_pool)


async def publish_file_progress(
    user_id: str,
    file_id: str,
    status: str,
    progress_pct: int,
    total_chunks: int = 0,
    error_message: str | None = None,
) -> None:
    client = get_redis_client()
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


async def append_chat_stream_event(
    assistant_msg_id: str,
    event_type: str,
    data: dict[str, Any],
) -> str:
    client = get_redis_client()
    stream_key = f"chat:stream:{assistant_msg_id}"
    entry_id = await client.xadd(
        stream_key,
        {"event": event_type, "data": json.dumps(data)},
        maxlen=5000,
        approximate=True,
    )
    await client.expire(stream_key, 3600)
    return entry_id
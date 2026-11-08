import asyncio
import json
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUserContext, get_current_user
from app.clients.redis_client import get_redis_client
from app.db.session import get_tenant_db_session
from app.repositories.chat_repo import ChatRepository

router = APIRouter(prefix="/streams", tags=["Resumable Real-Time SSE Streams"])


@router.get("/files")
async def stream_file_progress(
    request: Request,
    last_id: str = Query(default="0-0"),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    current_user: CurrentUserContext = Depends(get_current_user),
) -> StreamingResponse:
    cursor = last_event_id or last_id
    stream_key = f"file:stream:{current_user.user_id}"

    async def _event_generator() -> AsyncGenerator[str, None]:
        nonlocal cursor
        redis = get_redis_client()
        while True:
            if await request.is_disconnected():
                break
            events = await redis.xread({stream_key: cursor}, count=20, block=3000)
            if not events:
                yield ": keepalive\n\n"
                continue
            for _, entries in events:
                for entry_id, fields in entries:
                    cursor = entry_id
                    data_str = json.dumps(fields)
                    yield f"id: {entry_id}\nevent: file_progress\ndata: {data_str}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/{assistant_message_id}")
async def stream_chat_tokens(
    assistant_message_id: UUID,
    request: Request,
    last_id: str = Query(default="0-0"),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    current_user: CurrentUserContext = Depends(get_current_user),
) -> StreamingResponse:
    cursor = last_event_id or last_id
    stream_key = f"chat:stream:{assistant_message_id}"

    async def _event_generator() -> AsyncGenerator[str, None]:
        nonlocal cursor
        redis = get_redis_client()

        stream_exists = await redis.exists(stream_key)
        if not stream_exists:
            async with get_tenant_db_session(current_user.user_id) as session:
                repo = ChatRepository(session)
                msg = await repo.get_message(current_user.user_id, assistant_message_id)
                if msg and msg.status in ("COMPLETED", "FAILED"):
                    yield f"event: token\ndata: {json.dumps({'delta': msg.content})}\n\n"
                    yield f"event: done\ndata: {json.dumps({'citations': msg.citations, 'latency_ms': msg.latency_ms, 'cached': False})}\n\n"
                    return

        idle_ticks = 0
        while idle_ticks < 60:
            if await request.is_disconnected():
                break

            events = await redis.xread({stream_key: cursor}, count=50, block=2000)
            if not events:
                idle_ticks += 1
                async with get_tenant_db_session(current_user.user_id) as session:
                    repo = ChatRepository(session)
                    msg = await repo.get_message(current_user.user_id, assistant_message_id)
                    if msg and msg.status in ("COMPLETED", "FAILED") and cursor == "0-0":
                        yield f"event: token\ndata: {json.dumps({'delta': msg.content})}\n\n"
                        yield f"event: done\ndata: {json.dumps({'citations': msg.citations, 'latency_ms': msg.latency_ms, 'cached': False})}\n\n"
                        return
                yield ": keepalive\n\n"
                continue

            idle_ticks = 0
            for _, entries in events:
                for entry_id, fields in entries:
                    cursor = entry_id
                    ev_type = fields.get("event", "token")
                    ev_data = fields.get("data", "{}")
                    yield f"id: {entry_id}\nevent: {ev_type}\ndata: {ev_data}\n\n"
                    if ev_type in ("done", "error"):
                        return

            await asyncio.sleep(0.01)

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
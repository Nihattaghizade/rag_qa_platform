import asyncio
from typing import Any
from uuid import UUID

from app.clients.redis_client import append_chat_stream_event
from app.db.session import get_tenant_db_session
from app.rag.chat_engine import ConversationalRAGChatEngine
from app.repositories.chat_repo import ChatRepository
from app.workers.celery_app import celery_app
from app.workers.maintenance_worker import update_chat_summary_task


async def _run_chat_turn(
    user_id_str: str,
    chat_id_str: str,
    assistant_msg_id_str: str,
    user_query: str,
    scoped_file_ids_str: list[str] | None = None,
) -> dict[str, Any]:
    user_id = UUID(user_id_str)
    chat_id = UUID(chat_id_str)
    assistant_msg_id = UUID(assistant_msg_id_str)
    scoped_uuids = [UUID(fid) for fid in scoped_file_ids_str] if scoped_file_ids_str else None

    try:
        async with get_tenant_db_session(user_id) as session:
            chat_repo = ChatRepository(session)
            chat_session = await chat_repo.get_session(user_id=user_id, chat_id=chat_id)
            if not chat_session:
                raise ValueError("Chat session not found")

            history_objs = await chat_repo.list_messages(user_id=user_id, chat_id=chat_id, limit=12)
            recent_messages = [
                {"role": m.role, "content": m.content}
                for m in history_objs
                if m.id != assistant_msg_id and m.status == "COMPLETED" and m.content
            ]

            engine = ConversationalRAGChatEngine(session)
            result = await engine.execute_streaming_turn(
                user_id=user_id,
                chat_id=chat_id,
                assistant_msg_id=assistant_msg_id,
                user_query=user_query,
                rolling_summary=chat_session.rolling_summary,
                recent_messages=recent_messages,
                scoped_file_ids=scoped_uuids,
            )

            await chat_repo.update_assistant_message(
                message_id=assistant_msg_id,
                status=result["status"],
                content=result["content"],
                query_mode=result["query_mode"],
                rewritten_query=result["rewritten_query"],
                citations=result["citations"],
                prompt_tokens=result["prompt_tokens"],
                completion_tokens=result["completion_tokens"],
                latency_ms=result["latency_ms"],
            )

        update_chat_summary_task.delay(
            user_id_str,
            chat_id_str,
            user_query,
            result["content"],
        )
        return {"assistant_message_id": assistant_msg_id_str, "status": "COMPLETED"}

    except Exception as exc:
        err_msg = f"Error generating response: {str(exc)[:400]}"
        await append_chat_stream_event(
            assistant_msg_id_str,
            "error",
            {"message": err_msg},
        )
        async with get_tenant_db_session(user_id) as session:
            chat_repo = ChatRepository(session)
            await chat_repo.update_assistant_message(
                message_id=assistant_msg_id,
                status="FAILED",
                content=err_msg,
            )
        raise


@celery_app.task(
    name="app.workers.chat_worker.process_chat_turn_task",
    bind=True,
    max_retries=1,
)
def process_chat_turn_task(
    self,
    user_id_str: str,
    chat_id_str: str,
    assistant_msg_id_str: str,
    user_query: str,
    scoped_file_ids_str: list[str] | None = None,
) -> dict[str, Any]:
    return asyncio.run(
        _run_chat_turn(
            user_id_str=user_id_str,
            chat_id_str=chat_id_str,
            assistant_msg_id_str=assistant_msg_id_str,
            user_query=user_query,
            scoped_file_ids_str=scoped_file_ids_str,
        )
    )
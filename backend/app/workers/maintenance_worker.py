import asyncio
from uuid import UUID

from app.db.session import get_tenant_db_session
from app.rag.chat_engine import ConversationalRAGChatEngine
from app.repositories.chat_repo import ChatRepository
from app.workers.celery_app import celery_app


async def _run_update_summary(
    user_id_str: str,
    chat_id_str: str,
    user_query: str,
    assistant_answer: str,
) -> dict[str, str]:
    user_id = UUID(user_id_str)
    chat_id = UUID(chat_id_str)

    async with get_tenant_db_session(user_id) as session:
        chat_repo = ChatRepository(session)
        chat_session = await chat_repo.get_session(user_id=user_id, chat_id=chat_id)
        if not chat_session:
            return {"status": "SKIPPED"}

        engine = ConversationalRAGChatEngine(session)
        updated_summary = await engine.build_updated_rolling_summary(
            previous_summary=chat_session.rolling_summary,
            user_query=user_query,
            assistant_answer=assistant_answer,
        )

        new_title: str | None = None
        if chat_session.title == "New Conversation" and user_query.strip():
            new_title = user_query.strip()[:60]

        await chat_repo.update_rolling_summary(
            chat_id=chat_id,
            rolling_summary=updated_summary,
            title=new_title,
        )

    return {"chat_id": chat_id_str, "status": "SUMMARY_UPDATED"}


@celery_app.task(
    name="app.workers.maintenance_worker.update_chat_summary_task",
    bind=True,
    max_retries=1,
)
def update_chat_summary_task(
    self,
    user_id_str: str,
    chat_id_str: str,
    user_query: str,
    assistant_answer: str,
) -> dict[str, str]:
    return asyncio.run(_run_update_summary(user_id_str, chat_id_str, user_query, assistant_answer))
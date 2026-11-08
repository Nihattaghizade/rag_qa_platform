from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import ChatMessage, ChatSession


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_session(
        self,
        user_id: UUID,
        title: str = "New Conversation",
        scoped_file_ids: list[UUID] | None = None,
    ) -> ChatSession:
        chat = ChatSession(
            user_id=user_id,
            title=title,
            scoped_file_ids=[str(fid) for fid in (scoped_file_ids or [])],
            is_deleted=0,
        )
        self.session.add(chat)
        await self.session.flush()
        return chat

    async def get_session(self, user_id: UUID, chat_id: UUID) -> ChatSession | None:
        stmt = select(ChatSession).where(
            ChatSession.id == chat_id,
            ChatSession.user_id == user_id,
            ChatSession.is_deleted == 0,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_sessions(self, user_id: UUID) -> list[ChatSession]:
        stmt = (
            select(ChatSession)
            .where(
                ChatSession.user_id == user_id,
                ChatSession.is_archived.is_(False),
                ChatSession.is_deleted == 0,
            )
            .order_by(ChatSession.updated_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_message(
        self,
        chat_id: UUID,
        user_id: UUID,
        role: str,
        content: str,
        status: str = "COMPLETED",
    ) -> ChatMessage:
        msg = ChatMessage(
            chat_id=chat_id,
            user_id=user_id,
            role=role,
            content=content,
            status=status,
            is_deleted=0,
        )
        self.session.add(msg)
        await self.session.flush()
        return msg

    async def get_message(self, user_id: UUID, message_id: UUID) -> ChatMessage | None:
        stmt = select(ChatMessage).where(
            ChatMessage.id == message_id,
            ChatMessage.user_id == user_id,
            ChatMessage.is_deleted == 0,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_messages(self, user_id: UUID, chat_id: UUID, limit: int = 100) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(
                ChatMessage.chat_id == chat_id,
                ChatMessage.user_id == user_id,
                ChatMessage.is_deleted == 0,
            )
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_assistant_message(
        self,
        message_id: UUID,
        status: str,
        content: str,
        query_mode: str | None = None,
        rewritten_query: str | None = None,
        citations: list[dict[str, Any]] | None = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency_ms: int | None = None,
    ) -> None:
        stmt = (
            update(ChatMessage)
            .where(ChatMessage.id == message_id)
            .values(
                status=status,
                content=content,
                query_mode=query_mode,
                rewritten_query=rewritten_query,
                citations=citations or [],
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                latency_ms=latency_ms,
            )
        )
        await self.session.execute(stmt)

    async def update_rolling_summary(
        self,
        chat_id: UUID,
        rolling_summary: str,
        title: str | None = None,
    ) -> None:
        values: dict[str, Any] = {"rolling_summary": rolling_summary}
        if title:
            values["title"] = title
        stmt = update(ChatSession).where(ChatSession.id == chat_id).values(**values)
        await self.session.execute(stmt)
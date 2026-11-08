from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUserContext, get_current_user
from app.db.session import get_tenant_db_session
from app.repositories.chat_repo import ChatRepository
from app.schemas.dto import (
    ChatCreateRequest,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatMessageSubmitResponse,
    ChatSessionResponse,
)
from app.workers.chat_worker import process_chat_turn_task

router = APIRouter(prefix="/chats", tags=["Conversational RAG Chats"])


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    payload: ChatCreateRequest,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> ChatSessionResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = ChatRepository(session)
        chat = await repo.create_session(
            user_id=current_user.user_id,
            title=payload.title,
            scoped_file_ids=payload.scoped_file_ids,
        )
        return ChatSessionResponse.model_validate(chat)


@router.get("", response_model=list[ChatSessionResponse])
async def list_chat_sessions(
    current_user: CurrentUserContext = Depends(get_current_user),
) -> list[ChatSessionResponse]:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = ChatRepository(session)
        sessions = await repo.list_sessions(user_id=current_user.user_id)
        return [ChatSessionResponse.model_validate(s) for s in sessions]


@router.get("/{chat_id}/messages", response_model=list[ChatMessageResponse])
async def list_chat_messages(
    chat_id: UUID,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> list[ChatMessageResponse]:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = ChatRepository(session)
        chat = await repo.get_session(user_id=current_user.user_id, chat_id=chat_id)
        if not chat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
        messages = await repo.list_messages(user_id=current_user.user_id, chat_id=chat_id)
        return [ChatMessageResponse.model_validate(m) for m in messages]


@router.post(
    "/{chat_id}/messages",
    response_model=ChatMessageSubmitResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_chat_message(
    chat_id: UUID,
    payload: ChatMessageCreateRequest,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> ChatMessageSubmitResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = ChatRepository(session)
        chat = await repo.get_session(user_id=current_user.user_id, chat_id=chat_id)
        if not chat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

        user_msg = await repo.create_message(
            chat_id=chat_id,
            user_id=current_user.user_id,
            role="user",
            content=payload.content,
            status="COMPLETED",
        )
        assistant_msg = await repo.create_message(
            chat_id=chat_id,
            user_id=current_user.user_id,
            role="assistant",
            content="",
            status="STREAMING",
        )
        scoped_ids = (
            [str(fid) for fid in payload.scoped_file_ids]
            if payload.scoped_file_ids is not None
            else chat.scoped_file_ids
        )
        user_msg_id = user_msg.id
        assistant_msg_id = assistant_msg.id

    process_chat_turn_task.delay(
        str(current_user.user_id),
        str(chat_id),
        str(assistant_msg_id),
        payload.content,
        scoped_ids,
    )

    return ChatMessageSubmitResponse(
        user_message_id=user_msg_id,
        assistant_message_id=assistant_msg_id,
        chat_id=chat_id,
        status="STREAMING",
        stream_channel=f"/api/v1/streams/chat/{assistant_msg_id}",
    )
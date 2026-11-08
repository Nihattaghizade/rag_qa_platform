from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import CurrentUserContext, get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_tenant_db_session
from app.models.entities import ChatMessage, ChatSession, FileRecord, User
from app.schemas.dto import PasswordChangeRequest, UserUsageTelemetryResponse

router = APIRouter(prefix="/users", tags=["User Settings & Telemetry"])


@router.get("/me/usage", response_model=UserUsageTelemetryResponse)
async def get_my_usage_telemetry(
    current_user: CurrentUserContext = Depends(get_current_user),
) -> UserUsageTelemetryResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        user_res = await session.execute(select(User).where(User.id == current_user.user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        files_count_res = await session.execute(
            select(func.count(FileRecord.id)).where(FileRecord.user_id == current_user.user_id)
        )
        files_used = int(files_count_res.scalar() or 0)

        sessions_count_res = await session.execute(
            select(func.count(ChatSession.id)).where(ChatSession.user_id == current_user.user_id)
        )
        total_sessions = int(sessions_count_res.scalar() or 0)

        q_count_res = await session.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.user_id == current_user.user_id,
                ChatMessage.role == "user",
            )
        )
        questions_used = int(q_count_res.scalar() or 0)

        token_stats_res = await session.execute(
            select(
                func.coalesce(func.sum(ChatMessage.prompt_tokens), 0),
                func.coalesce(func.sum(ChatMessage.completion_tokens), 0),
                func.coalesce(func.avg(ChatMessage.latency_ms), 0.0),
            ).where(
                ChatMessage.user_id == current_user.user_id,
                ChatMessage.role == "assistant",
            )
        )
        prompt_sum, completion_sum, avg_lat = token_stats_res.one()

        recent_msgs_res = await session.execute(
            select(ChatMessage)
            .where(
                ChatMessage.user_id == current_user.user_id,
                ChatMessage.role == "assistant",
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(15)
        )
        recent_msgs = list(recent_msgs_res.scalars().all())

        return UserUsageTelemetryResponse(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            files_used=files_used,
            max_files=user.max_files,
            questions_used=questions_used,
            max_questions=user.max_questions,
            storage_used_bytes=max(0, int(user.storage_used_bytes)),
            storage_quota_bytes=int(user.storage_quota_bytes),
            total_chat_sessions=total_sessions,
            total_prompt_tokens=int(prompt_sum or 0),
            total_completion_tokens=int(completion_sum or 0),
            total_tokens=int((prompt_sum or 0) + (completion_sum or 0)),
            avg_latency_ms=round(float(avg_lat or 0.0), 1),
            recent_activity=[
                {
                    "id": str(m.id),
                    "status": m.status,
                    "query_mode": m.query_mode or "SINGLE_STEP_RAG",
                    "rewritten_query": m.rewritten_query or "",
                    "prompt_tokens": m.prompt_tokens,
                    "completion_tokens": m.completion_tokens,
                    "total_tokens": m.prompt_tokens + m.completion_tokens,
                    "latency_ms": m.latency_ms,
                    "citations_count": len(m.citations or []),
                    "created_at": m.created_at.isoformat(),
                }
                for m in recent_msgs
            ],
        )


@router.post("/me/password")
async def change_my_password(
    payload: PasswordChangeRequest,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> dict[str, str]:
    async with get_tenant_db_session(current_user.user_id) as session:
        user_res = await session.execute(select(User).where(User.id == current_user.user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        user.password_hash = hash_password(payload.new_password)
        await session.flush()

    return {"status": "Password updated successfully"}
import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserContext, get_current_user
from app.clients.qdrant_client import delete_user_vectors
from app.clients.s3_client import delete_s3_object
from app.db.session import get_db_session
from app.models.entities import ChatMessage, DocumentChunk, FileRecord, User
from app.schemas.dto import (
    AdminDashboardOverviewResponse,
    AdminUserSummaryItem,
    AdminUserUpdateLimitsRequest,
)

router = APIRouter(prefix="/admin", tags=["Admin Governance & Quotas"])


async def require_admin(
    current_user: CurrentUserContext = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    res = await session.execute(select(User).where(User.id == current_user.user_id))
    user = res.scalar_one_or_none()
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return user


@router.get("/overview", response_model=AdminDashboardOverviewResponse)
async def get_admin_dashboard_overview(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminDashboardOverviewResponse:
    users_res = await session.execute(select(User).order_by(User.created_at.desc()))
    all_users = list(users_res.scalars().all())

    user_items: list[AdminUserSummaryItem] = []
    platform_files = 0
    platform_chunks = 0
    platform_questions = 0
    platform_prompt_tokens = 0
    platform_completion_tokens = 0

    for u in all_users:
        await session.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(u.id)},
        )

        f_res = await session.execute(
            select(
                func.count(FileRecord.id),
                func.coalesce(func.sum(FileRecord.total_chunks), 0),
            ).where(FileRecord.user_id == u.id)
        )
        u_files, u_chunks = f_res.one()

        q_res = await session.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.user_id == u.id,
                ChatMessage.role == "user",
            )
        )
        u_questions = int(q_res.scalar() or 0)

        t_res = await session.execute(
            select(
                func.coalesce(func.sum(ChatMessage.prompt_tokens), 0),
                func.coalesce(func.sum(ChatMessage.completion_tokens), 0),
            ).where(ChatMessage.user_id == u.id)
        )
        u_prompt, u_completion = t_res.one()

        u_files_int = int(u_files or 0)
        u_chunks_int = int(u_chunks or 0)
        u_prompt_int = int(u_prompt or 0)
        u_completion_int = int(u_completion or 0)

        platform_files += u_files_int
        platform_chunks += u_chunks_int
        platform_questions += u_questions
        platform_prompt_tokens += u_prompt_int
        platform_completion_tokens += u_completion_int

        user_items.append(
            AdminUserSummaryItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                files_used=u_files_int,
                max_files=u.max_files,
                questions_used=u_questions,
                max_questions=u.max_questions,
                total_chunks=u_chunks_int,
                total_prompt_tokens=u_prompt_int,
                total_completion_tokens=u_completion_int,
                total_tokens=u_prompt_int + u_completion_int,
                storage_used_bytes=max(0, int(u.storage_used_bytes)),
                created_at=u.created_at,
            )
        )

    return AdminDashboardOverviewResponse(
        total_users=len(all_users),
        total_files=platform_files,
        total_chunks=platform_chunks,
        total_questions_asked=platform_questions,
        total_prompt_tokens=platform_prompt_tokens,
        total_completion_tokens=platform_completion_tokens,
        total_tokens=platform_prompt_tokens + platform_completion_tokens,
        users=user_items,
    )


@router.patch("/users/{target_user_id}/limits", response_model=AdminUserSummaryItem)
async def update_user_limits(
    target_user_id: UUID,
    payload: AdminUserUpdateLimitsRequest,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUserSummaryItem:
    res = await session.execute(select(User).where(User.id == target_user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")

    u.max_files = payload.max_files
    u.max_questions = payload.max_questions
    if payload.role:
        u.role = payload.role

    await session.commit()
    await session.refresh(u)

    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(u.id)},
    )
    f_res = await session.execute(
        select(
            func.count(FileRecord.id),
            func.coalesce(func.sum(FileRecord.total_chunks), 0),
        ).where(FileRecord.user_id == u.id)
    )
    u_files, u_chunks = f_res.one()

    q_res = await session.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.user_id == u.id,
            ChatMessage.role == "user",
        )
    )
    u_questions = int(q_res.scalar() or 0)

    t_res = await session.execute(
        select(
            func.coalesce(func.sum(ChatMessage.prompt_tokens), 0),
            func.coalesce(func.sum(ChatMessage.completion_tokens), 0),
        ).where(ChatMessage.user_id == u.id)
    )
    u_prompt, u_completion = t_res.one()

    return AdminUserSummaryItem(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
        files_used=int(u_files or 0),
        max_files=u.max_files,
        questions_used=u_questions,
        max_questions=u.max_questions,
        total_chunks=int(u_chunks or 0),
        total_prompt_tokens=int(u_prompt or 0),
        total_completion_tokens=int(u_completion or 0),
        total_tokens=int((u_prompt or 0) + (u_completion or 0)),
        storage_used_bytes=max(0, int(u.storage_used_bytes)),
        created_at=u.created_at,
    )


@router.delete("/users/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    target_user_id: UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    if target_user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot delete their own active account",
        )

    res = await session.execute(select(User).where(User.id == target_user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(target_user_id)},
    )
    files_res = await session.execute(select(FileRecord.s3_key).where(FileRecord.user_id == target_user_id))
    s3_keys = [row[0] for row in files_res.all()]

    await session.execute(delete(User).where(User.id == target_user_id))
    await session.commit()

    await asyncio.to_thread(delete_user_vectors, str(target_user_id))
    for key in s3_keys:
        try:
            await asyncio.to_thread(delete_s3_object, key)
        except Exception:
            pass
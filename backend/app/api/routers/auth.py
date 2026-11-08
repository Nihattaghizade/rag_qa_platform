from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserContext, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db_session
from app.repositories.user_repo import UserRepository
from app.schemas.dto import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegisterRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    repo = UserRepository(session)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    pwd_hash = hash_password(payload.password)
    user = await repo.create_user(
        email=payload.email,
        password_hash=pwd_hash,
        full_name=payload.full_name,
    )

    raw_refresh, refresh_hash, expires_at = create_refresh_token()
    await repo.save_refresh_token(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
        device_info=request.headers.get("user-agent", "")[:250],
    )
    await session.commit()
    await session.refresh(user)

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    access_token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(
    payload: UserLoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    repo = UserRepository(session)
    user = await repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    raw_refresh, refresh_hash, expires_at = create_refresh_token()
    await repo.save_refresh_token(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
        device_info=request.headers.get("user-agent", "")[:250],
    )
    await session.commit()

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    access_token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    repo = UserRepository(session)
    old_hash = hash_refresh_token(refresh_token)
    rt_record = await repo.get_valid_refresh_token(old_hash)
    if not rt_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = await repo.get_by_id(rt_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    await repo.revoke_refresh_token(old_hash)
    raw_refresh, new_hash, expires_at = create_refresh_token()
    await repo.save_refresh_token(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=expires_at,
        device_info=request.headers.get("user-agent", "")[:250],
    )
    await session.commit()

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    access_token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    if refresh_token:
        repo = UserRepository(session)
        await repo.revoke_refresh_token(hash_refresh_token(refresh_token))
        await session.commit()
    response.delete_cookie("refresh_token")


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUserContext = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    repo = UserRepository(session)
    user = await repo.get_by_id(current_user.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)
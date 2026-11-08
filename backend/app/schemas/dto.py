from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    storage_quota_bytes: int
    storage_used_bytes: int
    created_at: datetime


class FileUploadInitRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=512)
    mime_type: Literal[
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    size_bytes: int = Field(gt=0, le=524288000)
    content_sha256: str = Field(min_length=64, max_length=64)


class FileUploadPartUrl(BaseModel):
    part_number: int
    presigned_url: str


class FileUploadInitResponse(BaseModel):
    file_id: UUID
    s3_upload_id: str | None = None
    s3_key: str
    deduplicated: bool = False
    status: str
    part_size_bytes: int = 5242880
    parts: list[FileUploadPartUrl] = Field(default_factory=list)


class CompletedPartItem(BaseModel):
    PartNumber: int
    ETag: str


class FileUploadCompleteRequest(BaseModel):
    s3_upload_id: str
    parts: list[CompletedPartItem]


class FileRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    status: str
    progress_pct: int
    total_pages: int | None
    total_chunks: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class CitationItem(BaseModel):
    index: int
    chunk_id: UUID
    file_id: UUID
    filename: str
    page_number: int
    section_heading: str | None = None
    rerank_score: float
    excerpt: str


class ChatCreateRequest(BaseModel):
    title: str = Field(default="New Conversation", max_length=255)
    scoped_file_ids: list[UUID] = Field(default_factory=list)


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    rolling_summary: str | None
    scoped_file_ids: list[str]
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=16000)
    scoped_file_ids: list[UUID] | None = None


class ChatMessageSubmitResponse(BaseModel):
    user_message_id: UUID
    assistant_message_id: UUID
    chat_id: UUID
    status: str
    stream_channel: str


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chat_id: UUID
    role: str
    status: str
    query_mode: str | None
    rewritten_query: str | None
    content: str
    citations: list[dict[str, Any]]
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int | None
    created_at: datetime
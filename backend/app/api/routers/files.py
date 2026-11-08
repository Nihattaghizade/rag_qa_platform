import asyncio
import hashlib
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select

from app.api.deps import CurrentUserContext, get_current_user
from app.clients.kafka_client import publish_kafka_event
from app.clients.qdrant_client import delete_file_vectors
from app.clients.redis_client import (
    get_file_tasks,
    mark_file_cancelled,
    publish_file_progress,
    register_file_task,
)
from app.clients.s3_client import (
    PART_SIZE_BYTES,
    complete_multipart_upload,
    create_multipart_upload_urls,
    delete_s3_object,
    get_s3_client,
)
from app.core.config import settings
from app.db.session import get_tenant_db_session
from app.models.entities import DocumentChunk, FileRecord, User
from app.rag.semantic_cache import FourTierSemanticCache
from app.repositories.file_repo import FileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.dto import (
    ChunkPreviewItem,
    FileDetailedInspectionResponse,
    FileRecordResponse,
    FileUploadCompleteRequest,
    FileUploadInitRequest,
    FileUploadInitResponse,
    FileUploadPartUrl,
)
from app.workers.celery_app import celery_app
from app.workers.parser_worker import parse_and_chunk_document_task

router = APIRouter(prefix="/files", tags=["Files & Ingestion"])


async def _enforce_file_upload_quota(session, user_id: UUID) -> None:
    user_res = await session.execute(select(User).where(User.id == user_id, User.is_deleted == 0))
    user_obj = user_res.scalar_one_or_none()
    if not user_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    count_res = await session.execute(
        select(func.count(FileRecord.id)).where(
            FileRecord.user_id == user_id,
            FileRecord.is_deleted == 0,
        )
    )
    current_files = int(count_res.scalar() or 0)
    if current_files >= user_obj.max_files:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"File upload limit reached ({current_files}/{user_obj.max_files} files). Delete an existing file or contact Admin to increase your limit.",
        )


@router.post("/upload/init", response_model=FileUploadInitResponse)
async def init_multipart_file_upload(
    payload: FileUploadInitRequest,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> FileUploadInitResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        file_repo = FileRepository(session)
        existing = await file_repo.get_by_sha256(
            user_id=current_user.user_id,
            content_sha256=payload.content_sha256,
        )
        if existing and existing.status == "READY":
            return FileUploadInitResponse(
                file_id=existing.id,
                s3_upload_id=None,
                s3_key=existing.s3_key,
                deduplicated=True,
                status=existing.status,
                part_size_bytes=PART_SIZE_BYTES,
                parts=[],
            )

        if not existing:
            await _enforce_file_upload_quota(session, current_user.user_id)

        file_id = existing.id if existing else uuid.uuid4()
        safe_name = payload.filename.replace(" ", "_")
        s3_key = f"tenants/{current_user.user_id}/files/{file_id}/{safe_name}"

        upload_id, raw_parts = await asyncio.to_thread(
            create_multipart_upload_urls,
            s3_key,
            payload.mime_type,
            payload.size_bytes,
        )

        if not existing:
            await file_repo.create_file_record(
                file_id=file_id,
                user_id=current_user.user_id,
                filename=payload.filename,
                mime_type=payload.mime_type,
                size_bytes=payload.size_bytes,
                s3_bucket=settings.S3_BUCKET_NAME,
                s3_key=s3_key,
                content_sha256=payload.content_sha256,
                status="INITIATED",
            )
        else:
            await file_repo.update_status(file_id=file_id, status="INITIATED", progress_pct=0)

    return FileUploadInitResponse(
        file_id=file_id,
        s3_upload_id=upload_id,
        s3_key=s3_key,
        deduplicated=False,
        status="INITIATED",
        part_size_bytes=PART_SIZE_BYTES,
        parts=[FileUploadPartUrl(**p) for p in raw_parts],
    )


@router.post("/{file_id}/upload/complete", response_model=FileRecordResponse)
async def complete_file_upload(
    file_id: UUID,
    payload: FileUploadCompleteRequest,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> FileRecordResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        file_repo = FileRepository(session)
        user_repo = UserRepository(session)
        record = await file_repo.get_by_id(user_id=current_user.user_id, file_id=file_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File record not found")

        parts_dicts = [{"PartNumber": p.PartNumber, "ETag": p.ETag} for p in payload.parts]
        await asyncio.to_thread(complete_multipart_upload, record.s3_key, payload.s3_upload_id, parts_dicts)

        await file_repo.update_status(file_id=file_id, status="UPLOADED", progress_pct=10)
        await user_repo.increment_storage_used(current_user.user_id, record.size_bytes)
        updated = await file_repo.get_by_id(user_id=current_user.user_id, file_id=file_id)
        response_dto = FileRecordResponse.model_validate(updated)

    await publish_file_progress(str(current_user.user_id), str(file_id), "UPLOADED", 10)

    try:
        await publish_kafka_event(
            topic=settings.KAFKA_TOPIC_INGEST_RAW,
            key=str(current_user.user_id),
            payload={"user_id": str(current_user.user_id), "file_id": str(file_id)},
        )
    except Exception:
        pass

    task_res = parse_and_chunk_document_task.delay(str(current_user.user_id), str(file_id))
    if task_res and task_res.id:
        await register_file_task(str(file_id), str(task_res.id))
    return response_dto


@router.post("/upload/direct", response_model=FileRecordResponse, status_code=status.HTTP_202_ACCEPTED)
async def direct_file_upload(
    file: UploadFile = File(...),
    current_user: CurrentUserContext = Depends(get_current_user),
) -> FileRecordResponse:
    filename = file.filename or "document.pdf"
    lower_name = filename.lower()
    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    content_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    mime_type = (
        "application/pdf"
        if lower_name.endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    async with get_tenant_db_session(current_user.user_id) as session:
        file_repo = FileRepository(session)
        user_repo = UserRepository(session)
        existing = await file_repo.get_by_sha256(current_user.user_id, content_sha256)
        if existing and existing.status == "READY":
            return FileRecordResponse.model_validate(existing)

        if not existing:
            await _enforce_file_upload_quota(session, current_user.user_id)

        file_id = existing.id if existing else uuid.uuid4()
        safe_name = filename.replace(" ", "_")
        s3_key = f"tenants/{current_user.user_id}/files/{file_id}/{safe_name}"

        def _put_obj() -> None:
            s3 = get_s3_client(public=False)
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=raw_bytes,
                ContentType=mime_type,
            )

        await asyncio.to_thread(_put_obj)

        if not existing:
            await file_repo.create_file_record(
                file_id=file_id,
                user_id=current_user.user_id,
                filename=filename,
                mime_type=mime_type,
                size_bytes=len(raw_bytes),
                s3_bucket=settings.S3_BUCKET_NAME,
                s3_key=s3_key,
                content_sha256=content_sha256,
                status="UPLOADED",
            )
            await file_repo.update_status(file_id=file_id, status="UPLOADED", progress_pct=10)
            await user_repo.increment_storage_used(current_user.user_id, len(raw_bytes))
        else:
            await file_repo.update_status(file_id=file_id, status="UPLOADED", progress_pct=10)

        updated = await file_repo.get_by_id(current_user.user_id, file_id)
        response_dto = FileRecordResponse.model_validate(updated)

    await publish_file_progress(str(current_user.user_id), str(file_id), "UPLOADED", 10)
    task_res = parse_and_chunk_document_task.delay(str(current_user.user_id), str(file_id))
    if task_res and task_res.id:
        await register_file_task(str(file_id), str(task_res.id))
    return response_dto


@router.get("", response_model=list[FileRecordResponse])
async def list_files(
    current_user: CurrentUserContext = Depends(get_current_user),
) -> list[FileRecordResponse]:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = FileRepository(session)
        files = await repo.list_user_files(current_user.user_id)
        return [FileRecordResponse.model_validate(f) for f in files]


@router.get("/{file_id}/details", response_model=FileDetailedInspectionResponse)
async def get_file_details(
    file_id: UUID,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> FileDetailedInspectionResponse:
    async with get_tenant_db_session(current_user.user_id) as session:
        repo = FileRepository(session)
        record = await repo.get_by_id(current_user.user_id, file_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        stmt = (
            select(DocumentChunk)
            .where(
                DocumentChunk.file_id == file_id,
                DocumentChunk.user_id == current_user.user_id,
                DocumentChunk.is_deleted == 0,
            )
            .order_by(DocumentChunk.chunk_index.asc())
            .limit(50)
        )
        res = await session.execute(stmt)
        chunks = list(res.scalars().all())

        return FileDetailedInspectionResponse(
            file=FileRecordResponse.model_validate(record),
            chunks=[
                ChunkPreviewItem(
                    id=c.id,
                    chunk_index=c.chunk_index,
                    page_number=c.page_number,
                    section_heading=c.section_heading,
                    token_count=c.token_count,
                    parent_text=c.parent_text,
                    child_text=c.child_text,
                )
                for c in chunks
            ],
        )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    current_user: CurrentUserContext = Depends(get_current_user),
) -> None:
    file_id_str = str(file_id)
    await mark_file_cancelled(file_id_str)

    task_ids = await get_file_tasks(file_id_str)
    for tid in task_ids:
        try:
            celery_app.control.revoke(tid, terminate=True)
        except Exception:
            pass

    async with get_tenant_db_session(current_user.user_id) as session:
        file_repo = FileRepository(session)
        user_repo = UserRepository(session)
        record = await file_repo.delete_file(user_id=current_user.user_id, file_id=file_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        await user_repo.increment_storage_used(current_user.user_id, -record.size_bytes)
        s3_key = record.s3_key

    await publish_file_progress(str(current_user.user_id), file_id_str, "DELETED", 0)
    await asyncio.to_thread(delete_file_vectors, str(current_user.user_id), file_id_str)
    try:
        await asyncio.to_thread(delete_s3_object, s3_key)
    except Exception:
        pass
    await FourTierSemanticCache.invalidate_user_cache(current_user.user_id)
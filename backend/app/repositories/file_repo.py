from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import DocumentChunk, FileRecord


class FileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_sha256(self, user_id: UUID, content_sha256: str) -> FileRecord | None:
        stmt = select(FileRecord).where(
            FileRecord.user_id == user_id,
            FileRecord.content_sha256 == content_sha256,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID, file_id: UUID) -> FileRecord | None:
        stmt = select(FileRecord).where(
            FileRecord.id == file_id,
            FileRecord.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_user_files(self, user_id: UUID) -> list[FileRecord]:
        stmt = (
            select(FileRecord)
            .where(FileRecord.user_id == user_id)
            .order_by(FileRecord.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_file_record(
        self,
        file_id: UUID,
        user_id: UUID,
        filename: str,
        mime_type: str,
        size_bytes: int,
        s3_bucket: str,
        s3_key: str,
        content_sha256: str,
        status: str = "INITIATED",
    ) -> FileRecord:
        record = FileRecord(
            id=file_id,
            user_id=user_id,
            filename=filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
            s3_bucket=s3_bucket,
            s3_key=s3_key,
            content_sha256=content_sha256,
            status=status,
            progress_pct=0,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def update_status(
        self,
        file_id: UUID,
        status: str,
        progress_pct: int,
        total_pages: int | None = None,
        total_chunks: int | None = None,
        error_message: str | None = None,
    ) -> None:
        values: dict[str, Any] = {
            "status": status,
            "progress_pct": progress_pct,
        }
        if total_pages is not None:
            values["total_pages"] = total_pages
        if total_chunks is not None:
            values["total_chunks"] = total_chunks
        if error_message is not None:
            values["error_message"] = error_message

        stmt = update(FileRecord).where(FileRecord.id == file_id).values(**values)
        await self.session.execute(stmt)

    async def bulk_insert_chunks(self, chunks: list[DocumentChunk]) -> None:
        await self.session.execute(
            delete(DocumentChunk).where(DocumentChunk.file_id == chunks[0].file_id)
        ) if chunks else None
        self.session.add_all(chunks)
        await self.session.flush()

    async def get_chunks_by_ids(self, user_id: UUID, chunk_ids: list[UUID]) -> list[DocumentChunk]:
        if not chunk_ids:
            return []
        stmt = select(DocumentChunk).where(
            DocumentChunk.user_id == user_id,
            DocumentChunk.id.in_(chunk_ids),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete_file(self, user_id: UUID, file_id: UUID) -> FileRecord | None:
        record = await self.get_by_id(user_id, file_id)
        if record:
            await self.session.delete(record)
            await self.session.flush()
        return record
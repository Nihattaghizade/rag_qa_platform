import math
from typing import Any

import boto3
from botocore.config import Config

from app.core.config import settings

PART_SIZE_BYTES = 5 * 1024 * 1024


def get_s3_client(public: bool = False):
    endpoint = settings.S3_PUBLIC_ENDPOINT_URL if public else settings.S3_ENDPOINT_URL
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket_exists() -> None:
    s3 = get_s3_client(public=False)
    try:
        s3.head_bucket(Bucket=settings.S3_BUCKET_NAME)
    except Exception:
        s3.create_bucket(Bucket=settings.S3_BUCKET_NAME)


def create_multipart_upload_urls(s3_key: str, mime_type: str, size_bytes: int) -> tuple[str, list[dict[str, Any]]]:
    s3_internal = get_s3_client(public=False)
    s3_public = get_s3_client(public=True)
    resp = s3_internal.create_multipart_upload(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        ContentType=mime_type,
    )
    upload_id = resp["UploadId"]
    total_parts = max(1, math.ceil(size_bytes / PART_SIZE_BYTES))
    parts: list[dict[str, Any]] = []
    for part_num in range(1, total_parts + 1):
        url = s3_public.generate_presigned_url(
            ClientMethod="upload_part",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": s3_key,
                "UploadId": upload_id,
                "PartNumber": part_num,
            },
            ExpiresIn=3600,
        )
        parts.append({"part_number": part_num, "presigned_url": url})
    return upload_id, parts


def complete_multipart_upload(s3_key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
    s3 = get_s3_client(public=False)
    sorted_parts = sorted(parts, key=lambda x: x["PartNumber"])
    s3.complete_multipart_upload(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        UploadId=upload_id,
        MultipartUpload={"Parts": sorted_parts},
    )


def download_s3_object_bytes(s3_key: str) -> bytes:
    s3 = get_s3_client(public=False)
    response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    return response["Body"].read()


def delete_s3_object(s3_key: str) -> None:
    s3 = get_s3_client(public=False)
    s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
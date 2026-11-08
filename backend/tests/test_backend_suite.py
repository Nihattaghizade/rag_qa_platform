import uuid
import pymupdf as fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.rag.document_parser import StreamingDocumentParser
from app.rag.hybrid_chunker import ThreeStageHybridChunker
from app.rag.onnx_models import LocalONNXModelRegistry


def _make_sample_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "1. EXECUTIVE ARCHITECTURE OVERVIEW\n\n"
        "The Enterprise RAG Platform isolates multi-tenant documents using PostgreSQL Row-Level Security "
        "and Qdrant payload tenant indexing. All vector embeddings use BAAI/bge-small-en-v1.5 on CPU ONNX INT8.\n\n"
        "2. RESUMABLE STREAMING PIPELINE\n\n"
        "Every chat response streams tokens to Redis Streams so navigating across pages never interrupts generation.",
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_unit_onnx_embeddings_and_hybrid_chunker() -> None:
    pdf_bytes = _make_sample_pdf_bytes()
    total_pages, blocks = StreamingDocumentParser.parse_bytes(
        pdf_bytes, "application/pdf", "architecture_spec.pdf"
    )
    assert total_pages == 1
    assert len(blocks) >= 1

    chunker = ThreeStageHybridChunker()
    chunks = chunker.chunk_document("architecture_spec.pdf", blocks)
    assert len(chunks) >= 1
    assert "architecture_spec.pdf" in chunks[0].child_text

    dense = LocalONNXModelRegistry.embed_dense_batch([chunks[0].child_text])
    sparse = LocalONNXModelRegistry.embed_sparse_batch([chunks[0].child_text])
    scores = LocalONNXModelRegistry.rerank_pairs("PostgreSQL Row-Level Security", [chunks[0].child_text])

    assert len(dense[0]) == 384
    assert len(sparse[0]["indices"]) > 0
    assert isinstance(scores[0], float)


@pytest.mark.asyncio
async def test_integration_and_e2e_auth_files_and_chats() -> None:
    unique_email = f"tenant_{uuid.uuid4().hex[:10]}@enterprise.io"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        health_resp = await client.get("/health")
        assert health_resp.status_code == 200

        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "StrongPassword2026!",
                "full_name": "Enterprise Tenant User",
            },
        )
        assert reg_resp.status_code == 201
        token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me_resp = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == unique_email

        chat_resp = await client.post(
            "/api/v1/chats",
            json={"title": "Architecture Review Session", "scoped_file_ids": []},
            headers=headers,
        )
        assert chat_resp.status_code == 201
        chat_id = chat_resp.json()["id"]

        list_chats_resp = await client.get("/api/v1/chats", headers=headers)
        assert list_chats_resp.status_code == 200
        assert any(c["id"] == chat_id for c in list_chats_resp.json())
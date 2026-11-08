import uuid
import pymupdf as fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.db.session import get_tenant_db_session
from app.main import app
from app.rag.hybrid_retriever import TwoStageHybridRetriever
from app.workers.embedding_worker import _run_embed_and_index
from app.workers.parser_worker import _run_parse_and_chunk


def _build_enterprise_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(
        fitz.Rect(72, 72, 520, 700),
        "1. SECURITY & DATA ISOLATION POLICY\n\n"
        "Project Falcon mandates strict multi-tenant isolation across\n"
        "PostgreSQL 17 Row-Level Security and Qdrant payload tenant filters.\n"
        "The maximum allowed upload size per document is 500 MB.\n\n"
        "2. AI INFERENCE SPECIFICATION\n\n"
        "All dense embeddings are generated locally on CPU using\n"
        "BAAI/bge-small-en-v1.5 ONNX INT8 while conversational synthesis\n"
        "uses OpenAI GPT models via API key.",
    )
    raw = doc.tobytes()
    doc.close()
    return raw


@pytest.mark.asyncio
async def test_full_e2e_upload_parse_chunk_embed_and_hybrid_retrieve() -> None:
    email = f"e2e_{uuid.uuid4().hex[:8]}@enterprise.io"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "EnterprisePass2026!",
                "full_name": "E2E Verification User",
            },
        )
        assert reg.status_code == 201
        auth_data = reg.json()
        token = auth_data["access_token"]
        user_id_str = auth_data["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}

        pdf_bytes = _build_enterprise_pdf()
        upload_resp = await client.post(
            "/api/v1/files/upload/direct",
            files={"file": ("project_falcon_policy.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert upload_resp.status_code == 202
        file_id_str = upload_resp.json()["id"]

        parse_res = await _run_parse_and_chunk(user_id_str, file_id_str)
        assert int(parse_res["total_chunks"]) >= 1

        embed_res = await _run_embed_and_index(user_id_str, file_id_str)
        assert int(embed_res["indexed_points"]) >= 1

        files_list = await client.get("/api/v1/files", headers=headers)
        assert files_list.status_code == 200
        ready_file = next(f for f in files_list.json() if f["id"] == file_id_str)
        assert ready_file["status"] == "READY"
        assert ready_file["progress_pct"] == 100

        user_uuid = uuid.UUID(user_id_str)
        async with get_tenant_db_session(user_uuid) as session:
            retriever = TwoStageHybridRetriever(session)
            retrieved = await retriever.retrieve(
                user_id=user_uuid,
                query="What is the maximum allowed upload size in Project Falcon?",
                scoped_file_ids=[uuid.UUID(file_id_str)],
                top_k=3,
            )
            assert len(retrieved) >= 1
            assert "500 MB" in retrieved[0].parent_text
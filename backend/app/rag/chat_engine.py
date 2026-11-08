import time
from typing import Any
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.redis_client import append_chat_stream_event
from app.core.config import settings
from app.rag.hybrid_retriever import RetrievedContextChunk, TwoStageHybridRetriever
from app.rag.query_router import ConversationalRAGRouter
from app.rag.semantic_cache import FourTierSemanticCache

RAG_SYNTHESIS_SYSTEM_PROMPT = """You are an Enterprise Conversational Document Assistant.
You answer questions strictly grounded in the user's uploaded documents provided in the <context> block, while maintaining natural conversational flexibility for follow-ups, summaries, comparisons, and explanations of those documents.

Rules:
1. Ground every factual claim in the provided <context> chunks and cite sources inline using bracketed numbers like [1], [2].
2. If the user asks a follow-up ("explain that simply", "put that in a table", "summarize the previous point"), use both the <context> chunks and recent conversation history naturally.
3. Never invent facts not present in the <context> or conversation history. If the uploaded documents do not contain the answer, clearly state that the information was not found in the uploaded files.
4. Do NOT write unrelated software code, solve general math problems, or answer off-topic general knowledge questions."""


class ConversationalRAGChatEngine:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session
        self.retriever = TwoStageHybridRetriever(db_session)
        self.router = ConversationalRAGRouter()
        self.openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def execute_streaming_turn(
        self,
        user_id: UUID,
        chat_id: UUID,
        assistant_msg_id: UUID,
        user_query: str,
        rolling_summary: str | None,
        recent_messages: list[dict[str, str]],
        scoped_file_ids: list[UUID] | None = None,
    ) -> dict[str, Any]:
        start_ts = time.perf_counter()
        stream_id = str(assistant_msg_id)

        plan = await self.router.route_and_condense(
            user_query=user_query,
            rolling_summary=rolling_summary,
            recent_messages=recent_messages,
        )

        await append_chat_stream_event(
            stream_id,
            "meta",
            {
                "assistant_message_id": stream_id,
                "query_mode": plan.query_mode,
                "rewritten_query": plan.standalone_query,
            },
        )

        if plan.query_mode == "OUT_OF_SCOPE_GUARDRAIL":
            polite_refusal = (
                plan.guardrail_message
                or "I am configured exclusively to assist with questions, analysis, and discussions grounded in your uploaded documents. Please ask a question related to your files."
            )
            await append_chat_stream_event(stream_id, "token", {"delta": polite_refusal})
            latency_ms = int((time.perf_counter() - start_ts) * 1000)
            await append_chat_stream_event(
                stream_id,
                "done",
                {"citations": [], "latency_ms": latency_ms, "cached": False},
            )
            return {
                "status": "COMPLETED",
                "query_mode": plan.query_mode,
                "rewritten_query": plan.standalone_query,
                "content": polite_refusal,
                "citations": [],
                "prompt_tokens": 0,
                "completion_tokens": len(polite_refusal.split()),
                "latency_ms": latency_ms,
            }

        cached = await FourTierSemanticCache.get_cached_response(
            user_id=user_id,
            query=plan.standalone_query,
            scoped_file_ids=scoped_file_ids,
        )
        if cached:
            await append_chat_stream_event(stream_id, "token", {"delta": cached["content"]})
            latency_ms = int((time.perf_counter() - start_ts) * 1000)
            await append_chat_stream_event(
                stream_id,
                "done",
                {"citations": cached["citations"], "latency_ms": latency_ms, "cached": True},
            )
            return {
                "status": "COMPLETED",
                "query_mode": plan.query_mode,
                "rewritten_query": plan.standalone_query,
                "content": cached["content"],
                "citations": cached["citations"],
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "latency_ms": latency_ms,
            }

        retrieved_map: dict[UUID, RetrievedContextChunk] = {}
        queries_to_run = (
            plan.sub_queries if plan.query_mode == "MULTI_DOC_SYNTHESIS" else [plan.standalone_query]
        )
        for q in queries_to_run:
            chunks = await self.retriever.retrieve(
                user_id=user_id,
                query=q,
                scoped_file_ids=scoped_file_ids,
                top_k=6,
            )
            for c in chunks:
                if c.chunk_id not in retrieved_map or c.rerank_score > retrieved_map[c.chunk_id].rerank_score:
                    retrieved_map[c.chunk_id] = c

        final_chunks = sorted(retrieved_map.values(), key=lambda x: x.rerank_score, reverse=True)[:6]

        citations: list[dict[str, Any]] = []
        context_blocks: list[str] = []
        for idx, ch in enumerate(final_chunks, start=1):
            citations.append(
                {
                    "index": idx,
                    "chunk_id": str(ch.chunk_id),
                    "file_id": str(ch.file_id),
                    "filename": ch.filename,
                    "page_number": ch.page_number,
                    "section_heading": ch.section_heading,
                    "rerank_score": ch.rerank_score,
                    "excerpt": ch.parent_text[:320],
                }
            )
            context_blocks.append(
                f"[{idx}] Document: {ch.filename} | Page: {ch.page_number} | Section: {ch.section_heading or 'N/A'}\n"
                f"{ch.parent_text}"
            )

        context_str = "\n\n---\n\n".join(context_blocks) if context_blocks else "No matching document chunks found."
        history_str = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in recent_messages[-6:])

        user_prompt = (
            f"<rolling_summary>\n{rolling_summary or 'None'}\n</rolling_summary>\n\n"
            f"<recent_conversation>\n{history_str or 'None'}\n</recent_conversation>\n\n"
            f"<context>\n{context_str}\n</context>\n\n"
            f"User Question: {user_query}"
        )

        full_tokens: list[str] = []
        prompt_tokens = 0
        completion_tokens = 0

        stream = await self.openai.chat.completions.create(
            model=plan.target_model,
            temperature=0.2,
            stream=True,
            stream_options={"include_usage": True},
            messages=[
                {"role": "system", "content": RAG_SYNTHESIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                delta = chunk.choices[0].delta.content
                full_tokens.append(delta)
                await append_chat_stream_event(stream_id, "token", {"delta": delta})
            if getattr(chunk, "usage", None):
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0

        answer_text = "".join(full_tokens).strip()
        latency_ms = int((time.perf_counter() - start_ts) * 1000)

        if answer_text and final_chunks:
            await FourTierSemanticCache.set_cached_response(
                user_id=user_id,
                query=plan.standalone_query,
                scoped_file_ids=scoped_file_ids,
                response_payload={"content": answer_text, "citations": citations},
            )

        await append_chat_stream_event(
            stream_id,
            "done",
            {"citations": citations, "latency_ms": latency_ms, "cached": False},
        )

        return {
            "status": "COMPLETED",
            "query_mode": plan.query_mode,
            "rewritten_query": plan.standalone_query,
            "content": answer_text,
            "citations": citations,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": latency_ms,
        }

    async def build_updated_rolling_summary(
        self,
        previous_summary: str | None,
        user_query: str,
        assistant_answer: str,
    ) -> str:
        if not settings.OPENAI_API_KEY or "REPLACE_WITH" in settings.OPENAI_API_KEY:
            return previous_summary or ""
        try:
            resp = await self.openai.chat.completions.create(
                model=settings.OPENAI_DEFAULT_MODEL,
                temperature=0.1,
                max_tokens=250,
                messages=[
                    {
                        "role": "system",
                        "content": "Summarize the cumulative document conversation concisely in under 180 words.",
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Previous Summary: {previous_summary or 'None'}\n"
                            f"User: {user_query}\n"
                            f"Assistant: {assistant_answer[:1200]}"
                        ),
                    },
                ],
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception:
            return previous_summary or ""
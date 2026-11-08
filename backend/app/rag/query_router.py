import json
from dataclasses import dataclass
from typing import Literal

from openai import AsyncOpenAI

from app.core.config import settings

QueryMode = Literal[
    "SINGLE_STEP_RAG",
    "MULTI_DOC_SYNTHESIS",
    "CONVERSATIONAL_FOLLOWUP_RAG",
    "OUT_OF_SCOPE_GUARDRAIL",
]


@dataclass
class RoutedQueryPlan:
    query_mode: QueryMode
    standalone_query: str
    sub_queries: list[str]
    target_model: str
    guardrail_message: str | None = None


ROUTER_SYSTEM_PROMPT = """You are the Conversational RAG Intent Router and Query Condenser for an Enterprise Document QA Platform.
IMPORTANT: You do NOT see the contents of the user's uploaded documents yet. Assume ANY question about a topic, person, company, concept, term, section, summary, or fact is asking about the user's uploaded documents!

Your job is to:
1. Condense the user's message + conversation history into a clear standalone search query for vector + keyword retrieval.
2. Classify the request into one of four modes:
   - "SINGLE_STEP_RAG": DEFAULT mode for any question, topic inquiry, definition, extraction, or greeting/meta question about the uploaded documents.
   - "CONVERSATIONAL_FOLLOWUP_RAG": Follow-up asking to clarify, simplify, translate, summarize, expand, or format information from the documents or previous turn.
   - "MULTI_DOC_SYNTHESIS": Complex comparative or multi-part question requiring up to 3 sub-queries across documents.
   - "OUT_OF_SCOPE_GUARDRAIL": ONLY use this when the user explicitly commands you to write standalone software code (e.g. "write a python snake game") or solve pure math equations (e.g. "solve 3x + 7 = 22"). NEVER use OUT_OF_SCOPE_GUARDRAIL for questions about topics, facts, people, or documents.

Return ONLY valid JSON matching this schema:
{
  "query_mode": "SINGLE_STEP_RAG" | "CONVERSATIONAL_FOLLOWUP_RAG" | "MULTI_DOC_SYNTHESIS" | "OUT_OF_SCOPE_GUARDRAIL",
  "standalone_query": "string",
  "sub_queries": ["string"],
  "guardrail_message": "string or null"
}"""


class ConversationalRAGRouter:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def route_and_condense(
        self,
        user_query: str,
        rolling_summary: str | None,
        recent_messages: list[dict[str, str]],
        available_filenames: list[str] | None = None,
    ) -> RoutedQueryPlan:
        if not settings.OPENAI_API_KEY or "REPLACE_WITH" in settings.OPENAI_API_KEY:
            return RoutedQueryPlan(
                query_mode="SINGLE_STEP_RAG",
                standalone_query=user_query,
                sub_queries=[user_query],
                target_model=settings.OPENAI_DEFAULT_MODEL,
            )

        history_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:400]}" for m in recent_messages[-6:]
        )
        files_text = ", ".join(available_filenames) if available_filenames else "User uploaded documents"
        user_prompt = (
            f"User's Uploaded Files: {files_text}\n\n"
            f"Rolling Summary:\n{rolling_summary or 'None'}\n\n"
            f"Recent Conversation:\n{history_text or 'None'}\n\n"
            f"Latest User Message:\n{user_query}"
        )

        try:
            resp = await self.client.chat.completions.create(
                model=settings.OPENAI_DEFAULT_MODEL,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw_json = resp.choices[0].message.content or "{}"
            parsed = json.loads(raw_json)
            mode: QueryMode = parsed.get("query_mode", "SINGLE_STEP_RAG")
            standalone = parsed.get("standalone_query") or user_query
            sub_queries = parsed.get("sub_queries") or [standalone]
            target_model = (
                settings.OPENAI_COMPLEX_MODEL
                if mode == "MULTI_DOC_SYNTHESIS"
                else settings.OPENAI_DEFAULT_MODEL
            )
            return RoutedQueryPlan(
                query_mode=mode,
                standalone_query=standalone,
                sub_queries=sub_queries[:3],
                target_model=target_model,
                guardrail_message=parsed.get("guardrail_message"),
            )
        except Exception:
            return RoutedQueryPlan(
                query_mode="SINGLE_STEP_RAG",
                standalone_query=user_query,
                sub_queries=[user_query],
                target_model=settings.OPENAI_DEFAULT_MODEL,
            )
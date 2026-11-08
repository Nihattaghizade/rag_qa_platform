import json
import re
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

OFF_TOPIC_CODE_MATH_RE = re.compile(
    r"^\s*(?:write\s+(?:a\s+)?(?:python|javascript|java|c\+\+|html|sql)\s+(?:code|script|program)|solve\s+\d+[\+\-\*\/x=])",
    re.IGNORECASE,
)

FOLLOWUP_PRONOUN_RE = re.compile(
    r"\b(?:it|that|this|those|these|previous|above|shorter|simpler|table|translate|elaborate|more\s+detail)\b",
    re.IGNORECASE,
)


@dataclass
class RoutedQueryPlan:
    query_mode: QueryMode
    standalone_query: str
    sub_queries: list[str]
    target_model: str
    guardrail_message: str | None = None


ROUTER_SYSTEM_PROMPT = """Condense the follow-up message using the conversation history into one standalone search query for document retrieval.
Classify query_mode as:
- "CONVERSATIONAL_FOLLOWUP_RAG" (follow-up on previous answer)
- "SINGLE_STEP_RAG" (direct document question)
- "OUT_OF_SCOPE_GUARDRAIL" (ONLY if explicitly asking to write unrelated software code or solve pure math homework)

Return JSON:
{"query_mode": "SINGLE_STEP_RAG", "standalone_query": "string", "guardrail_message": null}"""


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
        clean_q = user_query.strip()

        if OFF_TOPIC_CODE_MATH_RE.search(clean_q):
            return RoutedQueryPlan(
                query_mode="OUT_OF_SCOPE_GUARDRAIL",
                standalone_query=clean_q,
                sub_queries=[clean_q],
                target_model=settings.OPENAI_DEFAULT_MODEL,
                guardrail_message="I am configured exclusively to assist with questions grounded in your uploaded documents.",
            )

        if not recent_messages or not FOLLOWUP_PRONOUN_RE.search(clean_q):
            return RoutedQueryPlan(
                query_mode="SINGLE_STEP_RAG",
                standalone_query=clean_q,
                sub_queries=[clean_q],
                target_model=settings.OPENAI_DEFAULT_MODEL,
            )

        if not settings.OPENAI_API_KEY or "REPLACE_WITH" in settings.OPENAI_API_KEY:
            return RoutedQueryPlan(
                query_mode="CONVERSATIONAL_FOLLOWUP_RAG",
                standalone_query=clean_q,
                sub_queries=[clean_q],
                target_model=settings.OPENAI_DEFAULT_MODEL,
            )

        history_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:180]}" for m in recent_messages[-3:]
        )
        user_prompt = f"History:\n{history_text}\n\nFollow-up: {clean_q}"

        try:
            resp = await self.client.chat.completions.create(
                model=settings.OPENAI_DEFAULT_MODEL,
                temperature=0.0,
                max_tokens=100,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            parsed = json.loads(resp.choices[0].message.content or "{}")
            mode: QueryMode = parsed.get("query_mode", "CONVERSATIONAL_FOLLOWUP_RAG")
            standalone = parsed.get("standalone_query") or clean_q
            return RoutedQueryPlan(
                query_mode=mode,
                standalone_query=standalone,
                sub_queries=[standalone],
                target_model=settings.OPENAI_DEFAULT_MODEL,
                guardrail_message=parsed.get("guardrail_message"),
            )
        except Exception:
            return RoutedQueryPlan(
                query_mode="CONVERSATIONAL_FOLLOWUP_RAG",
                standalone_query=clean_q,
                sub_queries=[clean_q],
                target_model=settings.OPENAI_DEFAULT_MODEL,
            )
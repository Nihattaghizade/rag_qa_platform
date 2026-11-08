import re
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.rag.document_parser import ParsedPageBlock
from app.rag.onnx_models import LocalONNXModelRegistry


@dataclass
class HierarchicalChunk:
    chunk_index: int
    page_number: int
    section_heading: str
    parent_text: str
    child_text: str
    token_count: int
    metadata: dict[str, Any]


class ThreeStageHybridChunker:
    SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

    def __init__(
        self,
        parent_max_words: int = 600,
        child_target_words: int = 140,
        semantic_drop_percentile: float = 25.0,
    ) -> None:
        self.parent_max_words = parent_max_words
        self.child_target_words = child_target_words
        self.semantic_drop_percentile = semantic_drop_percentile

    def chunk_document(self, filename: str, blocks: list[ParsedPageBlock]) -> list[HierarchicalChunk]:
        parent_segments = self._stage1_structural_parent_split(blocks)
        hierarchical_chunks: list[HierarchicalChunk] = []
        chunk_idx = 0

        for seg in parent_segments:
            child_texts = self._stage2_semantic_child_split(seg["parent_text"])
            for child_txt in child_texts:
                contextualized_child = (
                    f"[Document: {filename} | Section: {seg['section_heading']} | Page: {seg['page_number']}]\n"
                    f"{child_txt}"
                )
                token_est = max(1, int(len(contextualized_child.split()) * 1.3))
                hierarchical_chunks.append(
                    HierarchicalChunk(
                        chunk_index=chunk_idx,
                        page_number=seg["page_number"],
                        section_heading=seg["section_heading"],
                        parent_text=seg["parent_text"],
                        child_text=contextualized_child,
                        token_count=token_est,
                        metadata={
                            "filename": filename,
                            "page_number": seg["page_number"],
                            "section_heading": seg["section_heading"],
                        },
                    )
                )
                chunk_idx += 1

        return hierarchical_chunks

    def _stage1_structural_parent_split(self, blocks: list[ParsedPageBlock]) -> list[dict[str, Any]]:
        parents: list[dict[str, Any]] = []
        for block in blocks:
            paragraphs = [p.strip() for p in block.text.split("\n\n") if p.strip()]
            current_words: list[str] = []
            current_paras: list[str] = []

            for para in paragraphs:
                para_words = para.split()
                if len(current_words) + len(para_words) > self.parent_max_words and current_paras:
                    parents.append(
                        {
                            "page_number": block.page_number,
                            "section_heading": block.section_heading,
                            "parent_text": "\n\n".join(current_paras),
                        }
                    )
                    current_paras = [para]
                    current_words = para_words
                else:
                    current_paras.append(para)
                    current_words.extend(para_words)

            if current_paras:
                parents.append(
                    {
                        "page_number": block.page_number,
                        "section_heading": block.section_heading,
                        "parent_text": "\n\n".join(current_paras),
                    }
                )
        return parents

    def _stage2_semantic_child_split(self, parent_text: str) -> list[str]:
        sentences = [s.strip() for s in self.SENTENCE_SPLIT_RE.split(parent_text) if s.strip()]
        if len(sentences) <= 3:
            return [parent_text]

        dense_vecs = LocalONNXModelRegistry.embed_dense_batch(sentences)
        arr = np.array(dense_vecs, dtype=np.float32)
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-10
        normalized = arr / norms
        similarities = np.sum(normalized[:-1] * normalized[1:], axis=1)
        threshold = float(np.percentile(similarities, self.semantic_drop_percentile))

        children: list[str] = []
        current_bucket: list[str] = [sentences[0]]
        current_words = len(sentences[0].split())

        for idx in range(1, len(sentences)):
            sent = sentences[idx]
            sent_words = len(sent.split())
            sim = float(similarities[idx - 1])

            if (sim < threshold and current_words >= 45) or (current_words + sent_words > self.child_target_words):
                children.append(" ".join(current_bucket))
                overlap = current_bucket[-1:] if len(current_bucket) > 1 else []
                current_bucket = overlap + [sent]
                current_words = sum(len(s.split()) for s in current_bucket)
            else:
                current_bucket.append(sent)
                current_words += sent_words

        if current_bucket:
            children.append(" ".join(current_bucket))

        return children
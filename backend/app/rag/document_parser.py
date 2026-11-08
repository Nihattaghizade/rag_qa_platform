import io
import re
from dataclasses import dataclass

import fitz
from docx import Document as DocxDocument


@dataclass
class ParsedPageBlock:
    page_number: int
    section_heading: str
    text: str


class StreamingDocumentParser:
    HEADING_REGEX = re.compile(r"^(?:[A-Z0-9][A-Z0-9\s\.\-\:]{2,80}|(?:\d+\.)+\s+.+)$")

    @classmethod
    def parse_bytes(cls, file_bytes: bytes, mime_type: str, filename: str) -> tuple[int, list[ParsedPageBlock]]:
        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return cls._parse_pdf(file_bytes)
        return cls._parse_docx(file_bytes)

    @classmethod
    def _parse_pdf(cls, file_bytes: bytes) -> tuple[int, list[ParsedPageBlock]]:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc)
        blocks: list[ParsedPageBlock] = []
        current_heading = "Document Overview"

        for page_idx in range(total_pages):
            page = doc.load_page(page_idx)
            raw_blocks = page.get_text("blocks")
            page_lines: list[str] = []

            for b in raw_blocks:
                line_text = str(b[4]).strip()
                if not line_text:
                    continue
                first_line = line_text.splitlines()[0].strip()
                if len(first_line) < 90 and cls.HEADING_REGEX.match(first_line):
                    current_heading = first_line
                page_lines.append(line_text)

            combined = "\n\n".join(page_lines).strip()
            if combined:
                blocks.append(
                    ParsedPageBlock(
                        page_number=page_idx + 1,
                        section_heading=current_heading,
                        text=combined,
                    )
                )
        doc.close()
        return total_pages, blocks

    @classmethod
    def _parse_docx(cls, file_bytes: bytes) -> tuple[int, list[ParsedPageBlock]]:
        doc = DocxDocument(io.BytesIO(file_bytes))
        blocks: list[ParsedPageBlock] = []
        current_heading = "Document Overview"
        buffer: list[str] = []
        virtual_page = 1
        word_counter = 0

        for para in doc.paragraphs:
            txt = para.text.strip()
            if not txt:
                continue
            style_name = (para.style.name or "").lower()
            if "heading" in style_name or "title" in style_name:
                if buffer:
                    blocks.append(
                        ParsedPageBlock(
                            page_number=virtual_page,
                            section_heading=current_heading,
                            text="\n\n".join(buffer),
                        )
                    )
                    buffer = []
                current_heading = txt[:200]
            else:
                buffer.append(txt)
                word_counter += len(txt.split())
                if word_counter >= 350:
                    blocks.append(
                        ParsedPageBlock(
                            page_number=virtual_page,
                            section_heading=current_heading,
                            text="\n\n".join(buffer),
                        )
                    )
                    buffer = []
                    word_counter = 0
                    virtual_page += 1

        if buffer:
            blocks.append(
                ParsedPageBlock(
                    page_number=virtual_page,
                    section_heading=current_heading,
                    text="\n\n".join(buffer),
                )
            )
        return max(1, virtual_page), blocks
"""PDF / DOCX -> text segments -> token-sized chunks -> embeddings -> pgvector."""
import logging
from pathlib import Path

import pymupdf as fitz  # PyMuPDF
from django.conf import settings
from django.db import transaction
from docx import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph

from chat import llm

from .models import Chunk, Document

log = logging.getLogger(__name__)

try:  # tiktoken needs to download its vocabulary once; fall back to words if that is impossible
    import tiktoken

    _ENC = tiktoken.get_encoding("cl100k_base")
except Exception:  # pragma: no cover
    _ENC = None


def count_tokens(text: str) -> int:
    return len(_ENC.encode(text)) if _ENC else int(len(text.split()) * 1.3)


def chunk_text(text: str, max_tokens: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    step = max(1, max_tokens - overlap)
    if _ENC:
        toks = _ENC.encode(text)
        if len(toks) <= max_tokens:
            return [text]
        out = []
        for start in range(0, len(toks), step):
            piece = _ENC.decode(toks[start : start + max_tokens]).strip()
            if piece:
                out.append(piece)
            if start + max_tokens >= len(toks):
                break
        return out
    words = text.split()
    w_max, w_step = int(max_tokens * 0.75), int(step * 0.75) or 1
    if len(words) <= w_max:
        return [text]
    out = []
    for start in range(0, len(words), w_step):
        out.append(" ".join(words[start : start + w_max]))
        if start + w_max >= len(words):
            break
    return out


# A segment is (text, page_or_None, human_location)
Segment = tuple[str, int | None, str]


def extract_pdf(path: Path) -> list[Segment]:
    segments: list[Segment] = []
    with fitz.open(path) as pdf:
        for i, page in enumerate(pdf, start=1):
            text = page.get_text("text").strip()
            if text:
                segments.append((text, i, f"Page {i}"))
    return segments


def extract_docx(path: Path) -> list[Segment]:
    """DOCX has no stable page numbers, so we cite the nearest heading instead."""
    doc = DocxDocument(str(path))
    segments: list[Segment] = []
    heading, buf = "Introduction", []

    def flush():
        text = "\n".join(buf).strip()
        if text:
            segments.append((f"{heading}\n{text}", None, f"Section: {heading}"))
        buf.clear()

    for child in doc.element.body.iterchildren():
        if child.tag.endswith("}p"):
            p = Paragraph(child, doc)
            if not p.text.strip():
                continue
            if p.style is not None and p.style.name.lower().startswith(("heading", "title")):
                flush()
                heading = p.text.strip()
            else:
                buf.append(p.text.strip())
        elif child.tag.endswith("}tbl"):
            for row in Table(child, doc).rows:
                buf.append(" | ".join(c.text.strip() for c in row.cells))
    flush()
    return segments


def ingest_document(doc: Document) -> Document:
    """(Re)build all chunks for a document. Safe to call repeatedly."""
    doc.status, doc.error = Document.Status.PROCESSING, ""
    doc.save(update_fields=["status", "error"])
    try:
        path = Path(doc.file.path)
        segments = extract_pdf(path) if doc.file_type == "pdf" else extract_docx(path)
        if not segments:
            raise ValueError("No extractable text found (scanned PDFs need OCR, which this app does not do).")

        pieces: list[tuple[str, int | None, str]] = []
        for text, page, location in segments:
            for piece in chunk_text(text, settings.CHUNK_TOKENS, settings.CHUNK_OVERLAP):
                pieces.append((piece, page, location))

        vectors = llm.embed_texts([p[0] for p in pieces])
        with transaction.atomic():
            doc.chunks.all().delete()
            Chunk.objects.bulk_create(
                [
                    Chunk(
                        document=doc,
                        location=loc,
                        page=page,
                        position=i,
                        content=text,
                        token_count=count_tokens(text),
                        embedding=vec,
                    )
                    for i, ((text, page, loc), vec) in enumerate(zip(pieces, vectors))
                ],
                batch_size=100,
            )
            doc.status = Document.Status.READY
            doc.page_count = len({s[1] or s[2] for s in segments})
            doc.chunk_count = len(pieces)
            doc.save(update_fields=["status", "page_count", "chunk_count"])
        log.info("Ingested %s: %d segments, %d chunks", doc.title, len(segments), len(pieces))
    except Exception as exc:
        log.exception("Ingestion failed for document %s", doc.pk)
        doc.status, doc.error = Document.Status.FAILED, str(exc)[:1000]
        doc.save(update_fields=["status", "error"])
    return doc

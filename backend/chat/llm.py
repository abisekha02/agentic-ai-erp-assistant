"""Thin wrapper around the OpenAI SDK, plus a deterministic offline mode for tests/demo."""
import hashlib
import json
import logging
import math
import re

from django.conf import settings

log = logging.getLogger(__name__)
_client = None


class LLMNotConfigured(RuntimeError):
    pass


def client():
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise LLMNotConfigured("OPENAI_API_KEY is not set. Add it to .env (or set FAKE_AI=1 for offline mode).")
        from openai import OpenAI

        _client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60, max_retries=2)
    return _client


# ---- embeddings -------------------------------------------------------------
_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "of", "to", "is", "are", "in", "on", "for", "and", "or", "how", "what", "do", "i", "my",
         "me", "can", "it", "be", "per", "at", "by", "with", "we", "our", "does", "many", "much", "this", "that"}


def _fake_embed(text: str) -> list[float]:
    vec = [0.0] * settings.EMBEDDING_DIM
    for w in _WORD.findall(text.lower()):
        if w in _STOP:
            continue
        h = int(hashlib.md5(w.encode()).hexdigest(), 16)
        vec[h % settings.EMBEDDING_DIM] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if settings.FAKE_AI:
        return [_fake_embed(t) for t in texts]
    out: list[list[float]] = []
    for i in range(0, len(texts), 64):
        batch = [t.replace("\n", " ") for t in texts[i : i + 64]]
        resp = client().embeddings.create(model=settings.EMBEDDING_MODEL, input=batch)
        out.extend(d.embedding for d in resp.data)
    return out


# ---- chat completions -------------------------------------------------------
def chat_json(system: str, user: str) -> dict:
    resp = client().chat.completions.create(
        model=settings.CHAT_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Model returned non-JSON output: %.200s", raw)
        return {"_raw": raw}

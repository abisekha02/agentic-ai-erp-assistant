"""Thin wrapper around the OpenAI SDK, plus a deterministic offline mode for tests/demo."""
import hashlib
import json
import logging
import math
import re
import time

from django.conf import settings

log = logging.getLogger(__name__)
_client = None
_TRANSIENT = ("InternalServerError", "RateLimitError", "APIConnectionError", "APITimeoutError")


class LLMNotConfigured(RuntimeError):
    pass


def client():
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise LLMNotConfigured("OPENAI_API_KEY is not set. Add it to .env (or set FAKE_AI=1 for offline mode).")
        from openai import OpenAI

        _client = OpenAI(
            api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, timeout=settings.LLM_TIMEOUT, max_retries=0
        )
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
        for attempt in range(3):
            try:
                resp = client().embeddings.create(
                    model=settings.EMBEDDING_MODEL, input=batch, dimensions=settings.EMBEDDING_DIM
                )
                break
            except Exception as exc:
                if exc.__class__.__name__ not in _TRANSIENT or attempt == 2:
                    raise
                log.warning("Embedding %s (attempt %d): %s", exc.__class__.__name__, attempt + 1, exc)
                time.sleep(1.5 * (attempt + 1))
        out.extend(d.embedding for d in resp.data)
    return out


# ---- chat completions -------------------------------------------------------
def _parse_json(raw: str) -> dict:
    """Models sometimes wrap JSON in ``` fences or add a sentence around it; be tolerant."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    log.warning("Model returned non-JSON output: %.200s", raw)
    return {"_raw": raw}


def _complete(model: str, system: str, user: str, json_mode: bool):
    kwargs = dict(
        model=model,
        temperature=0,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    return client().chat.completions.create(**kwargs)


def chat_json(system: str, user: str) -> dict:
    """Try the main model, then the fallback model, retrying briefly on overload / rate limits."""
    models = [m for m in (settings.CHAT_MODEL, settings.CHAT_MODEL_FALLBACK) if m]
    json_mode = True
    last_exc: Exception | None = None
    for model in models:
        for attempt in range(2):
            try:
                try:
                    resp = _complete(model, system, user, json_mode)
                except Exception as exc:
                    # Some providers reject response_format; the prompts already demand JSON.
                    if exc.__class__.__name__ == "BadRequestError" and json_mode:
                        log.info("Provider rejected response_format, retrying without it")
                        json_mode = False
                        resp = _complete(model, system, user, json_mode)
                    else:
                        raise
                return _parse_json(resp.choices[0].message.content or "{}")
            except Exception as exc:
                last_exc = exc
                if exc.__class__.__name__ not in _TRANSIENT:
                    raise
                log.warning("%s failed on %s (attempt %d): %s", exc.__class__.__name__, model, attempt + 1, exc)
                time.sleep(1.5 * (attempt + 1))
    raise last_exc  # type: ignore[misc]
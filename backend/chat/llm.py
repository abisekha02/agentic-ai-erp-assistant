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


def _complete(model: str, system: str, user: str, json_mode: bool, use_temperature: bool = True):
    kwargs = dict(model=model, messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
    if use_temperature:
        kwargs["temperature"] = 0
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    return client().chat.completions.create(**kwargs)


# Newer providers/models reject some optional parameters; fall back to simpler requests in this order.
_OPTION_STEPS = [(True, True), (False, True), (False, False)]  # (json_mode, use_temperature)


def chat_json(system: str, user: str) -> dict:
    """Try the main model, then the fallback. Retries briefly on overload/rate limits, drops optional
    parameters a model rejects (400), and skips to the next model if one is unavailable (404)."""
    models = [m for m in (settings.CHAT_MODEL, settings.CHAT_MODEL_FALLBACK) if m]
    last_exc: Exception | None = None
    step = 0
    for model in models:
        for attempt in range(2):
            try:
                while True:
                    json_mode, use_temp = _OPTION_STEPS[step]
                    try:
                        resp = _complete(model, system, user, json_mode, use_temp)
                        return _parse_json(resp.choices[0].message.content or "{}")
                    except Exception as exc:
                        if exc.__class__.__name__ == "BadRequestError" and step < len(_OPTION_STEPS) - 1:
                            step += 1
                            log.info("%s rejected a request option, retrying with %s", model, _OPTION_STEPS[step])
                            continue
                        raise
            except Exception as exc:
                last_exc = exc
                name = exc.__class__.__name__
                if name == "NotFoundError":
                    log.warning("Model %s is not available for this key (404); trying the next model", model)
                    break  # no point retrying this model
                if name not in _TRANSIENT:
                    raise
                log.warning("%s failed on %s (attempt %d): %s", name, model, attempt + 1, exc)
                time.sleep(1.5 * (attempt + 1))
    raise last_exc  # type: ignore[misc]

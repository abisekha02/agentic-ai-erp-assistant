import logging
import time

from django.conf import settings

from .graph import get_graph
from .models import Conversation, Message, PendingAction

log = logging.getLogger(__name__)


def _history(conv: Conversation, limit: int = 6) -> list[dict]:
    msgs = list(conv.messages.order_by("-created_at", "-id")[:limit])[::-1]
    return [{"role": m.role, "content": m.content} for m in msgs]


def _store_assistant(conv, state: dict, started: float) -> Message:
    chunks = state.get("chunks", [])
    msg = Message.objects.create(
        conversation=conv,
        role=Message.Role.ASSISTANT,
        content=state.get("answer", ""),
        sources=state.get("sources", []),
        meta={
            "intent": state.get("intent"),
            "trace": state.get("trace", []),
            "found": state.get("found"),
            "latency_ms": int((time.monotonic() - started) * 1000),
            "retrieved": [{"chunk_id": c["chunk_id"], "similarity": c["similarity"]} for c in chunks],
            "model": "fake" if settings.FAKE_AI else settings.CHAT_MODEL,
        },
    )
    conv.save(update_fields=["updated_at"])
    return msg


def run_chat(user, conv: Conversation, text: str) -> Message:
    started = time.monotonic()
    history = _history(conv)
    Message.objects.create(conversation=conv, role=Message.Role.USER, content=text)
    if conv.title == "New conversation":
        conv.title = text[:60]
        conv.save(update_fields=["title"])

    state = get_graph().invoke(
        {"user_id": user.id, "role": user.role, "conversation_id": conv.id, "question": text, "history": history}
    )
    msg = _store_assistant(conv, state, started)
    if state.get("pending_action_id"):
        PendingAction.objects.filter(pk=state["pending_action_id"]).update(message=msg)
    log.info("chat user=%s intent=%s trace=%s ms=%s", user.id, state.get("intent"), state.get("trace"), msg.meta["latency_ms"])
    return msg


def resolve_action(user, action: PendingAction, decision: str) -> Message:
    started = time.monotonic()
    state = get_graph().invoke(
        {"user_id": user.id, "role": user.role, "conversation_id": action.conversation_id,
         "action_id": action.id, "decision": decision}
    )
    return _store_assistant(action.conversation, state, started)

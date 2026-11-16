"""LangGraph workflow.

START -> (action_id set?) -> execute_action -> END                     (resume after human decision)
      -> classify --question------> retrieve -> answer -> END
                  --leave_balance-> leave_balance -> END
                  --smalltalk-----> smalltalk -> END
                  --leave_request-> propose_leave --(valid)--> approval_gate -> END
                                                  --(missing info)------------> END

Human-in-the-loop: `approval_gate` persists a PendingAction and the graph stops. Nothing is executed until the
user clicks Approve, which re-enters the graph at `execute_action`. State lives in PostgreSQL, so it survives
restarts and works with multiple workers. (LangGraph's `interrupt()` + PostgresSaver is an alternative design.)
"""
import logging
from datetime import date, timedelta
from typing import TypedDict

from django.db import transaction
from django.utils import timezone
from langgraph.graph import END, START, StateGraph

from accounts.models import User
from hr import services as hr

from . import rag
from .models import PendingAction

log = logging.getLogger(__name__)


class ChatState(TypedDict, total=False):
    user_id: int
    role: str
    conversation_id: int
    question: str
    history: list
    action_id: int
    decision: str
    intent: str
    standalone: str
    leave: dict
    chunks: list
    answer: str
    sources: list
    found: bool
    pending_action_id: int
    trace: list


def _t(state: ChatState, step: str) -> list:
    return [*state.get("trace", []), step]


# ---- nodes -------------------------------------------------------------------
def entry_router(state: ChatState) -> str:
    return "execute_action" if state.get("action_id") else "classify"


def classify(state: ChatState) -> dict:  # "Query agent"
    r = rag.classify(state["question"], state.get("history", []), date.today())
    return {"intent": r["intent"], "standalone": r["standalone_question"], "leave": r["leave"], "trace": _t(state, "classify")}


def after_classify(state: ChatState) -> str:
    return {"question": "retrieve", "leave_balance": "leave_balance", "leave_request": "propose_leave"}.get(
        state["intent"], "smalltalk"
    )


def retrieve(state: ChatState) -> dict:  # "Retrieval agent"
    chunks = rag.retrieve(state["standalone"], state["role"])
    return {"chunks": chunks, "trace": _t(state, f"retrieve({len(chunks)})")}


def answer(state: ChatState) -> dict:  # "Answer agent"
    r = rag.generate_answer(state["standalone"], state.get("chunks", []), state.get("history", []))
    return {"answer": r["answer"], "sources": r["sources"], "found": r["found"], "trace": _t(state, "answer")}


def leave_balance(state: ChatState) -> dict:
    user = User.objects.get(pk=state["user_id"])
    b = hr.get_balance(user)
    text = (
        f"From the HR system: you have {b['remaining']} annual leave days remaining "
        f"({b['annual_total']} per year, {b['taken']} taken"
        + (f", {b['pending']} in requests awaiting approval" if b["pending"] else "")
        + ")."
    )
    return {"answer": text, "sources": [], "found": True, "trace": _t(state, "leave_balance")}


def smalltalk(state: ChatState) -> dict:
    return {
        "answer": "Hello! Ask me about company policies and procedures, check your leave balance, "
                  "or tell me to request leave.",
        "sources": [], "found": True, "trace": _t(state, "smalltalk"),
    }


def propose_leave(state: ChatState) -> dict:  # "Action agent"
    user = User.objects.get(pk=state["user_id"])
    clean, problems = hr.validate_leave(user, state.get("leave") or {})
    if problems:
        return {
            "answer": "I can set that up, but I still need " + "; ".join(problems) + ".",
            "sources": [], "found": True, "trace": _t(state, "propose_leave:needs_info"),
        }
    return {"leave": clean, "trace": _t(state, "propose_leave:ready")}


def after_propose(state: ChatState) -> str:
    return END if state.get("answer") else "approval_gate"


def approval_gate(state: ChatState) -> dict:  # "Approval agent": stop here and wait for a human
    c = state["leave"]
    summary = f"{c['leave_type'].title()} leave, {c['start_date']} to {c['end_date']} ({c['days']} working days)"
    action = PendingAction.objects.create(
        user_id=state["user_id"],
        conversation_id=state["conversation_id"],
        action_type="create_leave_request",
        payload=c,
        summary=summary,
    )
    return {
        "pending_action_id": action.id,
        "answer": "I've drafted this leave request. Nothing is submitted until you approve it below.",
        "sources": [], "found": True, "trace": _t(state, "approval_gate:waiting"),
    }


def execute_action(state: ChatState) -> dict:
    uid, decision = state["user_id"], state["decision"]
    with transaction.atomic():
        action = PendingAction.objects.select_for_update().filter(pk=state["action_id"], user_id=uid).first()
        if action is None:
            return {"answer": "I couldn't find that action.", "trace": _t(state, "execute:missing")}
        if action.status != PendingAction.Status.PENDING:
            return {"answer": f"That request was already {action.status}.", "pending_action_id": action.id,
                    "trace": _t(state, "execute:stale")}
        action.decided_at = timezone.now()
        if decision != "approve":
            action.status, action.result = PendingAction.Status.REJECTED, "Rejected by user"
            action.save()
            return {"answer": "Okay - I've cancelled it. Nothing was submitted.", "pending_action_id": action.id,
                    "trace": _t(state, "execute:rejected")}
        user = User.objects.get(pk=uid)
        clean, problems = hr.validate_leave(user, action.payload)  # re-validate: state may have changed
        if problems:
            action.status, action.result = PendingAction.Status.FAILED, "; ".join(problems)
            action.save()
            return {"answer": "I couldn't submit it: you'd need " + "; ".join(problems) + ".",
                    "pending_action_id": action.id, "trace": _t(state, "execute:failed")}
        req = hr.create_leave_request(user, clean)
        action.status, action.result = PendingAction.Status.EXECUTED, f"Leave request #{req.id} submitted"
        action.save()
    return {
        "answer": f"Done - leave request #{req.id} has been submitted to your manager for approval.",
        "pending_action_id": action.id, "trace": _t(state, "execute:done"),
    }


def build_graph():
    g = StateGraph(ChatState)
    for name, fn in [
        ("classify", classify), ("retrieve", retrieve), ("answer", answer), ("leave_balance", leave_balance),
        ("smalltalk", smalltalk), ("propose_leave", propose_leave), ("approval_gate", approval_gate),
        ("execute_action", execute_action),
    ]:
        g.add_node(name, fn)
    g.add_conditional_edges(START, entry_router, {"classify": "classify", "execute_action": "execute_action"})
    g.add_conditional_edges(
        "classify", after_classify,
        {"retrieve": "retrieve", "leave_balance": "leave_balance", "propose_leave": "propose_leave", "smalltalk": "smalltalk"},
    )
    g.add_edge("retrieve", "answer")
    g.add_conditional_edges("propose_leave", after_propose, {"approval_gate": "approval_gate", END: END})
    for n in ("answer", "leave_balance", "smalltalk", "approval_gate", "execute_action"):
        g.add_edge(n, END)
    return g.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph

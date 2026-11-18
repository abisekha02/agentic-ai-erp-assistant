import logging
from collections import Counter
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from documents.models import Document
from hr.models import LeaveRequest

from . import services
from .llm import LLMNotConfigured
from .models import Conversation, Message, PendingAction
from .serializers import (
    AskSerializer, ConversationSerializer, DecisionSerializer, FeedbackSerializer, MessageSerializer,
)

log = logging.getLogger(__name__)


def _ai_error(exc: Exception) -> Response:
    if isinstance(exc, LLMNotConfigured):
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    log.exception("AI pipeline error")
    return Response({"detail": "The AI service had a problem. Please try again."}, status=status.HTTP_502_BAD_GATEWAY)


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)


class ConversationDetailView(APIView):
    def get(self, request, pk):
        conv = get_object_or_404(Conversation, pk=pk, user=request.user)
        msgs = conv.messages.prefetch_related("actions")
        return Response({"id": conv.id, "title": conv.title, "messages": MessageSerializer(msgs, many=True).data})

    def delete(self, request, pk):
        get_object_or_404(Conversation, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AskView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ask"

    def post(self, request):
        ser = AskSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cid = ser.validated_data.get("conversation_id")
        conv = get_object_or_404(Conversation, pk=cid, user=request.user) if cid else Conversation.objects.create(user=request.user)
        try:
            msg = services.run_chat(request.user, conv, ser.validated_data["message"])
        except Exception as exc:
            return _ai_error(exc)
        msg = Message.objects.prefetch_related("actions").get(pk=msg.pk)
        return Response({"conversation_id": conv.id, "title": conv.title, "message": MessageSerializer(msg).data})


class FeedbackView(APIView):
    def post(self, request, pk):
        msg = get_object_or_404(Message, pk=pk, conversation__user=request.user, role=Message.Role.ASSISTANT)
        ser = FeedbackSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        msg.feedback = ser.validated_data["rating"]
        msg.feedback_comment = ser.validated_data.get("comment", "")
        msg.save(update_fields=["feedback", "feedback_comment"])
        return Response({"id": msg.id, "feedback": msg.feedback})


class ActionDecisionView(APIView):
    def post(self, request, pk):
        action = get_object_or_404(PendingAction, pk=pk, user=request.user)
        ser = DecisionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            msg = services.resolve_action(request.user, action, ser.validated_data["decision"])
        except Exception as exc:
            return _ai_error(exc)
        action.refresh_from_db()
        msg = Message.objects.prefetch_related("actions").get(pk=msg.pk)
        from .serializers import ActionSerializer

        return Response({"message": MessageSerializer(msg).data, "action": ActionSerializer(action).data})


class StatsView(APIView):
    """Admin-only numbers for the Analytics page. Everything is derived from stored messages and feedback."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()
        user_msgs = Message.objects.filter(role=Message.Role.USER)
        assistant = Message.objects.filter(role=Message.Role.ASSISTANT)

        q7 = user_msgs.filter(created_at__gte=now - timedelta(days=7)).count()
        q_prev = user_msgs.filter(created_at__gte=now - timedelta(days=14), created_at__lt=now - timedelta(days=7)).count()
        change = round((q7 - q_prev) / q_prev * 100) if q_prev else None

        question_msgs = assistant.filter(meta__intent="question")
        asked, not_found = question_msgs.count(), question_msgs.filter(meta__found=False).count()
        rated = assistant.exclude(feedback=None)
        rated_n, helpful_n = rated.count(), rated.filter(feedback=1).count()

        recent = list(assistant.order_by("-id").values_list("meta", "sources")[:500])
        latencies = [m.get("latency_ms") for m, _ in recent[:200] if isinstance(m, dict) and m.get("latency_ms")]
        cited = Counter(src.get("document") for _, srcs in recent for src in (srcs or []) if src.get("document"))

        per_day = {
            r["day"]: r["n"]
            for r in user_msgs.filter(created_at__gte=now - timedelta(days=14))
            .annotate(day=TruncDate("created_at")).values("day").annotate(n=Count("id"))
        }
        series = [
            {"date": (today - timedelta(days=i)).isoformat(), "count": per_day.get(today - timedelta(days=i), 0)}
            for i in range(13, -1, -1)
        ]

        downvoted = []
        for m in rated.filter(feedback=-1).select_related("conversation__user").order_by("-id")[:5]:
            q = Message.objects.filter(conversation_id=m.conversation_id, role="user", id__lt=m.id).order_by("-id").first()
            downvoted.append({
                "id": m.id, "user": m.conversation.user.username,
                "question": q.content[:140] if q else "", "answer": m.content[:160], "comment": m.feedback_comment,
            })

        docs = Document.objects
        return Response({
            "documents": {"total": docs.count(), "ready": docs.filter(status="ready").count(),
                          "admin_only": docs.filter(access_level="admin").count()},
            "conversations": Conversation.objects.count(),
            "questions_7d": q7, "questions_change_pct": change,
            "not_found_rate": round(not_found / asked * 100) if asked else None, "questions_total": asked,
            "helpful_rate": round(helpful_n / rated_n * 100) if rated_n else None, "rated": rated_n,
            "avg_latency_s": round(sum(latencies) / len(latencies) / 1000, 1) if latencies else None,
            "leave_requests": LeaveRequest.objects.count(),
            "daily": series,
            "top_documents": [{"document": d, "count": c} for d, c in cited.most_common(5)],
            "downvoted": downvoted,
        })

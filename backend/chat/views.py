import logging

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

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

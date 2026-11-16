from django.conf import settings
from django.db import models


class Conversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=120, default="New conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user"
        ASSISTANT = "assistant"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    meta = models.JSONField(default=dict, blank=True)  # intent, graph trace, latency, retrieval scores
    feedback = models.SmallIntegerField(null=True, blank=True)  # 1 helpful, -1 not helpful
    feedback_comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class PendingAction(models.Model):
    """A side-effecting action proposed by the AI. Nothing runs until a human approves it."""

    class Status(models.TextChoices):
        PENDING = "pending"
        EXECUTED = "executed"
        REJECTED = "rejected"
        FAILED = "failed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pending_actions")
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="actions")
    message = models.ForeignKey(Message, null=True, on_delete=models.SET_NULL, related_name="actions")
    action_type = models.CharField(max_length=40)
    payload = models.JSONField()
    summary = models.CharField(max_length=300)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    result = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

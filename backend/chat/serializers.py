from rest_framework import serializers

from .models import Conversation, Message, PendingAction


class ActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingAction
        fields = ("id", "action_type", "payload", "summary", "status", "result", "created_at", "decided_at")


class MessageSerializer(serializers.ModelSerializer):
    action = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "role", "content", "sources", "feedback", "created_at", "action")

    def get_action(self, obj):
        a = next(iter(obj.actions.all()), None)
        return ActionSerializer(a).data if a else None


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "title", "updated_at")


class AskSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000, trim_whitespace=True)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)


class FeedbackSerializer(serializers.Serializer):
    rating = serializers.ChoiceField(choices=[1, -1])
    comment = serializers.CharField(max_length=500, required=False, allow_blank=True)


class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject"])

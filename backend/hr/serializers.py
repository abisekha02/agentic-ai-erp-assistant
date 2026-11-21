from rest_framework import serializers

from .models import LeaveRequest


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee = serializers.CharField(source="user.username", read_only=True)
    employee_name = serializers.SerializerMethodField()
    decided_by = serializers.CharField(source="decided_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = (
            "id", "employee", "employee_name", "leave_type", "start_date", "end_date", "days", "reason",
            "status", "created_at", "decided_by", "decided_at", "decision_note",
        )

    def get_employee_name(self, obj):
        return obj.user.first_name or obj.user.username


class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "reject"])
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)

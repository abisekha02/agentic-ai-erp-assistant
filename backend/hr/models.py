from django.conf import settings
from django.db import models


class LeaveBalance(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave_balance")
    annual_total = models.PositiveIntegerField(default=20)
    annual_taken = models.PositiveIntegerField(default=0)  # approved + already taken


class LeaveRequest(models.Model):
    class Type(models.TextChoices):
        ANNUAL = "annual"
        SICK = "sick"
        PARENTAL = "parental"
        UNPAID = "unpaid"

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted - awaiting manager"
        APPROVED = "approved"
        REJECTED = "rejected"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.CharField(max_length=20, choices=Type.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveIntegerField()
    reason = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="leave_decisions"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]

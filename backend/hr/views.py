import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole

from . import services
from .models import LeaveRequest
from .serializers import DecisionSerializer, LeaveRequestSerializer

log = logging.getLogger(__name__)


class MyLeaveView(APIView):
    """The signed-in user's balance and their own requests."""

    def get(self, request):
        reqs = LeaveRequest.objects.filter(user=request.user).select_related("user", "decided_by")
        return Response({"balance": services.get_balance(request.user), "requests": LeaveRequestSerializer(reqs, many=True).data})


class LeaveRequestListView(generics.ListAPIView):
    """Admins see every request; optionally filter with ?status=submitted."""

    permission_classes = [IsAdminRole]
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("user", "decided_by")
        wanted = self.request.query_params.get("status")
        if wanted in LeaveRequest.Status.values:
            qs = qs.filter(status=wanted)
        return qs


class LeaveDecisionView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        ser = DecisionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            req = LeaveRequest.objects.select_for_update(of=("self",)).select_related("user").filter(pk=pk).first()
            if req is None:
                return Response({"detail": "Request not found."}, status=status.HTTP_404_NOT_FOUND)
            if req.user_id == request.user.id:
                return Response({"detail": "You can't decide your own leave request."}, status=status.HTTP_403_FORBIDDEN)
            if req.status != LeaveRequest.Status.SUBMITTED:
                return Response({"detail": f"This request was already {req.status}."}, status=status.HTTP_409_CONFLICT)
            approve = ser.validated_data["decision"] == "approve"
            req.status = LeaveRequest.Status.APPROVED if approve else LeaveRequest.Status.REJECTED
            req.decided_by, req.decided_at = request.user, timezone.now()
            req.decision_note = ser.validated_data.get("note", "")
            req.save()
        log.info("leave #%s %s by %s", req.id, req.status, request.user.username)
        return Response(LeaveRequestSerializer(req).data)

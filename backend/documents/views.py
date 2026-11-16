from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import IsAdminRole

from .ingestion import ingest_document
from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Everyone can list documents they are allowed to read; only admins can change anything."""

    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "list":
            return super().get_permissions()
        return [IsAdminRole()]

    def get_queryset(self):
        qs = Document.objects.select_related("uploaded_by")
        if not self.request.user.is_admin_role:
            qs = qs.filter(access_level=Document.Access.ALL, status=Document.Status.READY)
        return qs

    def perform_create(self, serializer):
        doc = serializer.save(uploaded_by=self.request.user)
        ingest_document(doc)  # synchronous for simplicity; move to a task queue for large files

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        ser.instance.refresh_from_db()
        return Response(self.get_serializer(ser.instance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        doc = self.get_object()
        ingest_document(doc)
        doc.refresh_from_db()
        return Response(self.get_serializer(doc).data)

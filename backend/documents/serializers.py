from django.conf import settings
from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)

    class Meta:
        model = Document
        fields = (
            "id", "title", "file", "original_name", "file_type", "access_level",
            "status", "error", "page_count", "chunk_count", "uploaded_by", "created_at",
        )
        read_only_fields = ("original_name", "file_type", "status", "error", "page_count", "chunk_count", "created_at")
        extra_kwargs = {"file": {"write_only": True}, "title": {"required": False}}

    def validate_file(self, f):
        ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else ""
        if ext not in ("pdf", "docx"):
            raise serializers.ValidationError("Only .pdf and .docx files are supported.")
        if f.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
            raise serializers.ValidationError(f"File is larger than {settings.MAX_UPLOAD_MB} MB.")
        return f

    def create(self, validated):
        f = validated["file"]
        validated["original_name"] = f.name
        validated["file_type"] = f.name.rsplit(".", 1)[-1].lower()
        validated.setdefault("title", f.name.rsplit(".", 1)[0].replace("_", " "))
        return super().create(validated)

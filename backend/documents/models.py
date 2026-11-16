from django.conf import settings
from django.db import models
from pgvector.django import HnswIndex, VectorField


class Document(models.Model):
    class Access(models.TextChoices):
        ALL = "all", "All employees"
        ADMIN = "admin", "Admins only"

    class Status(models.TextChoices):
        PROCESSING = "processing"
        READY = "ready"
        FAILED = "failed"

    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="documents/")
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    access_level = models.CharField(max_length=10, choices=Access.choices, default=Access.ALL)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PROCESSING)
    error = models.TextField(blank=True)
    page_count = models.PositiveIntegerField(default=0)
    chunk_count = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Chunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    location = models.CharField(max_length=200)  # "Page 2" or "Section: Eligibility"
    page = models.PositiveIntegerField(null=True, blank=True)
    position = models.PositiveIntegerField()
    content = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    embedding = VectorField(dimensions=1536)

    class Meta:
        ordering = ["document_id", "position"]
        indexes = [
            HnswIndex(
                name="chunk_embedding_hnsw",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            )
        ]

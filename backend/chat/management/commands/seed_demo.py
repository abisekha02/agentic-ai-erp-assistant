import tempfile
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from accounts.models import User
from documents.ingestion import ingest_document
from documents.models import Document
from sample_docs.generate import generate


class Command(BaseCommand):
    help = "Create demo users and ingest the fictional sample documents."

    def handle(self, *args, **opts):
        admin, _ = User.objects.get_or_create(username="admin", defaults={"email": "admin@northwind.test", "role": "admin", "first_name": "Asha"})
        admin.set_password("Admin@12345"); admin.role = "admin"; admin.save()
        emp, _ = User.objects.get_or_create(username="priya", defaults={"email": "priya@northwind.test", "first_name": "Priya"})
        emp.set_password("Employee@12345"); emp.save()
        emp.leave_balance.annual_taken = 6
        emp.leave_balance.save()
        self.stdout.write("Users: admin / Admin@12345 (admin), priya / Employee@12345 (employee)")

        with tempfile.TemporaryDirectory() as tmp:
            for spec in generate(Path(tmp)):
                if Document.objects.filter(title=spec["title"]).exists():
                    self.stdout.write(f"skip {spec['title']} (exists)")
                    continue
                path: Path = spec["path"]
                with path.open("rb") as fh:
                    doc = Document(
                        title=spec["title"], original_name=path.name, file_type=path.suffix[1:],
                        access_level=spec["access"], uploaded_by=admin,
                    )
                    doc.file.save(path.name, File(fh), save=True)
                ingest_document(doc)
                self.stdout.write(f"{doc.title}: {doc.status}, {doc.chunk_count} chunks")

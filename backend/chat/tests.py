import tempfile
from datetime import date, timedelta
from pathlib import Path

from django.core.files import File
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from documents.ingestion import ingest_document
from documents.models import Document
from hr.models import LeaveRequest
from sample_docs.generate import generate


def next_weekday(days_ahead: int) -> date:
    d = date.today() + timedelta(days=days_ahead)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


@override_settings(FAKE_AI=True, MEDIA_ROOT=tempfile.mkdtemp())
class AssistantTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("boss", "boss@x.test", "Admin@12345", role="admin")
        cls.emp = User.objects.create_user("ria", "ria@x.test", "Employee@12345")
        with tempfile.TemporaryDirectory() as tmp:
            for spec in generate(Path(tmp)):
                with spec["path"].open("rb") as fh:
                    doc = Document(title=spec["title"], original_name=spec["path"].name,
                                   file_type=spec["path"].suffix[1:], access_level=spec["access"], uploaded_by=cls.admin)
                    doc.file.save(spec["path"].name, File(fh), save=True)
                ingest_document(doc)

    def ask(self, user, text, conv=None):
        self.client.force_authenticate(user)
        r = self.client.post("/api/chat/ask/", {"message": text, "conversation_id": conv}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_documents_ingested_with_locations(self):
        leave = Document.objects.get(title="Leave Policy")
        self.assertEqual(leave.status, "ready")
        self.assertEqual({c.location for c in leave.chunks.all()}, {"Page 1", "Page 2"})
        laptop = Document.objects.get(title="Laptop Request Procedure")
        self.assertTrue(any(c.location.startswith("Section:") for c in laptop.chunks.all()))

    def test_answer_has_citation_with_page(self):
        data = self.ask(self.emp, "How many days of annual leave do employees get?")["message"]
        self.assertTrue(data["sources"])
        self.assertEqual(data["sources"][0]["document"], "Leave Policy")
        self.assertIn("Page", data["sources"][0]["location"])

    def test_unanswerable_question_is_refused(self):
        data = self.ask(self.emp, "What dental insurance coverage do we offer?")["message"]
        self.assertEqual(data["sources"], [])
        self.assertIn("couldn't find", data["content"])

    def test_employee_cannot_see_admin_documents(self):
        emp = self.ask(self.emp, "What is the salary range for band E1?")["message"]
        self.assertEqual(emp["sources"], [])
        adm = self.ask(self.admin, "What is the salary range for band E1?")["message"]
        self.assertEqual(adm["sources"][0]["document"], "Executive Compensation Bands")

    def test_leave_request_requires_approval_then_executes(self):
        s, e = next_weekday(14), next_weekday(15)
        data = self.ask(self.emp, f"Please book annual leave from {s} to {e}")
        action = data["message"]["action"]
        self.assertEqual(action["status"], "pending")
        self.assertEqual(LeaveRequest.objects.count(), 0)  # nothing happens before approval
        r = self.client.post(f"/api/chat/actions/{action['id']}/decision/", {"decision": "approve"}, format="json")
        self.assertEqual(r.json()["action"]["status"], "executed")
        self.assertEqual(LeaveRequest.objects.filter(user=self.emp).count(), 1)
        # approving twice must not create a second request
        self.client.post(f"/api/chat/actions/{action['id']}/decision/", {"decision": "approve"}, format="json")
        self.assertEqual(LeaveRequest.objects.filter(user=self.emp).count(), 1)

    def test_reject_creates_nothing(self):
        s = next_weekday(20)
        action = self.ask(self.emp, f"Book annual leave from {s} to {s}")["message"]["action"]
        r = self.client.post(f"/api/chat/actions/{action['id']}/decision/", {"decision": "reject"}, format="json")
        self.assertEqual(r.json()["action"]["status"], "rejected")
        self.assertEqual(LeaveRequest.objects.count(), 0)

    def test_cannot_decide_someone_elses_action(self):
        s = next_weekday(20)
        action = self.ask(self.emp, f"Book annual leave from {s} to {s}")["message"]["action"]
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/chat/actions/{action['id']}/decision/", {"decision": "approve"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_missing_dates_asks_followup(self):
        data = self.ask(self.emp, "I want to book leave")["message"]
        self.assertIsNone(data["action"])
        self.assertIn("still need", data["content"])

    def test_register_cannot_choose_role(self):
        self.client.force_authenticate(None)
        r = self.client.post("/api/auth/register/", {"username": "new", "email": "n@x.test", "password": "Str0ng!pass#1", "role": "admin"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(username="new").role, "employee")

    def test_only_admin_can_upload_and_conversations_are_private(self):
        self.client.force_authenticate(self.emp)
        self.assertEqual(self.client.post("/api/documents/", {}, format="multipart").status_code, 403)
        conv = self.ask(self.emp, "hello")["conversation_id"]
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f"/api/chat/conversations/{conv}/").status_code, 404)

    def test_feedback(self):
        msg = self.ask(self.emp, "How long is paternity leave?")["message"]
        r = self.client.post(f"/api/chat/messages/{msg['id']}/feedback/", {"rating": -1, "comment": "wrong"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_admin_can_change_access_and_employee_list_is_filtered(self):
        doc = Document.objects.get(title="Executive Compensation Bands")
        self.client.force_authenticate(self.emp)
        titles = {d["title"] for d in self.client.get("/api/documents/").json()}
        self.assertNotIn("Executive Compensation Bands", titles)
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f"/api/documents/{doc.id}/", {"access_level": "all"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.force_authenticate(self.emp)
        titles = {d["title"] for d in self.client.get("/api/documents/").json()}
        self.assertIn("Executive Compensation Bands", titles)
        # restore so other tests are unaffected (TestCase rolls back anyway)

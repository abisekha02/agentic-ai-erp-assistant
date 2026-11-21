from datetime import date, timedelta

from rest_framework.test import APITestCase

from accounts.models import User
from hr import services
from hr.models import LeaveRequest


def weekday(days_ahead: int) -> date:
    d = date.today() + timedelta(days=days_ahead)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


class LeaveApprovalTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("boss", "boss@x.test", "Admin@12345", role="admin")
        cls.emp = User.objects.create_user("ria", "ria@x.test", "Employee@12345")
        cls.emp.leave_balance.annual_taken = 6
        cls.emp.leave_balance.save()

    def make_request(self, user=None, days=2):
        start = weekday(10)
        clean, problems = services.validate_leave(
            user or self.emp,
            {"leave_type": "annual", "start_date": start.isoformat(), "end_date": (start + timedelta(days=days - 1)).isoformat()},
        )
        self.assertEqual(problems, [])
        return services.create_leave_request(user or self.emp, clean)

    def decide(self, user, req, decision, note=""):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/hr/requests/{req.id}/decision/", {"decision": decision, "note": note}, format="json")

    def test_balance_is_consistent_through_the_lifecycle(self):
        req = self.make_request()
        b = services.get_balance(self.emp)
        self.assertEqual((b["taken"], b["pending"], b["remaining"]), (6, req.days, 20 - 6 - req.days))
        self.assertEqual(self.decide(self.admin, req, "approve").status_code, 200)
        b = services.get_balance(self.emp)  # approved days must not be counted twice or released
        self.assertEqual((b["taken"], b["pending"], b["remaining"]), (6 + req.days, 0, 20 - 6 - req.days))

    def test_reject_releases_days_and_stores_note(self):
        req = self.make_request()
        r = self.decide(self.admin, req, "reject", "Team is short that week")
        self.assertEqual(r.json()["status"], "rejected")
        self.assertEqual(r.json()["decision_note"], "Team is short that week")
        self.assertEqual(r.json()["decided_by"], "boss")
        self.assertEqual(services.get_balance(self.emp)["remaining"], 14)

    def test_employee_cannot_decide_or_list_all(self):
        req = self.make_request()
        self.assertEqual(self.decide(self.emp, req, "approve").status_code, 403)
        self.assertEqual(self.client.get("/api/hr/requests/").status_code, 403)
        req.refresh_from_db()
        self.assertEqual(req.status, "submitted")

    def test_admin_cannot_approve_own_request(self):
        req = self.make_request(user=self.admin)
        self.assertEqual(self.decide(self.admin, req, "approve").status_code, 403)

    def test_cannot_decide_twice(self):
        req = self.make_request()
        self.assertEqual(self.decide(self.admin, req, "approve").status_code, 200)
        self.assertEqual(self.decide(self.admin, req, "reject").status_code, 409)
        req.refresh_from_db()
        self.assertEqual(req.status, "approved")

    def test_my_leave_shows_only_own_requests(self):
        mine = self.make_request()
        self.make_request(user=self.admin)
        self.client.force_authenticate(self.emp)
        data = self.client.get("/api/hr/my/").json()
        self.assertEqual([r["id"] for r in data["requests"]], [mine.id])
        self.assertEqual(data["balance"]["remaining"], 20 - 6 - mine.days)

    def test_admin_list_filter(self):
        a, b = self.make_request(), self.make_request()
        self.decide(self.admin, a, "approve")
        self.client.force_authenticate(self.admin)
        pending = self.client.get("/api/hr/requests/?status=submitted").json()
        self.assertEqual([r["id"] for r in pending], [b.id])
        self.assertEqual(len(self.client.get("/api/hr/requests/").json()), 2)

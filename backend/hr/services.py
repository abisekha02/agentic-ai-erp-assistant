"""HR business logic. The AI layer calls these functions; it never touches the tables directly."""
from datetime import date, timedelta

from django.db.models import Sum

from .models import LeaveBalance, LeaveRequest

MAX_REASON = 300


def working_days(start: date, end: date) -> int:
    n, d = 0, start
    while d <= end:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def get_balance(user) -> dict:
    """Annual leave: total - already taken - approved - awaiting approval. Rejected requests release their days."""
    bal, _ = LeaveBalance.objects.get_or_create(user=user)
    annual = LeaveRequest.objects.filter(user=user, leave_type="annual")
    pending = annual.filter(status="submitted").aggregate(s=Sum("days"))["s"] or 0
    approved = annual.filter(status="approved").aggregate(s=Sum("days"))["s"] or 0
    taken = bal.annual_taken + approved
    return {
        "annual_total": bal.annual_total,
        "taken": taken,
        "pending": pending,
        "remaining": bal.annual_total - taken - pending,
    }


def validate_leave(user, params: dict):
    """Returns (clean_params | None, [human-readable problems])."""
    problems: list[str] = []
    leave_type = (params.get("leave_type") or "").strip().lower()
    if leave_type not in LeaveRequest.Type.values:
        problems.append("the leave type (annual, sick, parental or unpaid)")

    def parse(key, label):
        raw = params.get(key)
        if not raw:
            problems.append(label)
            return None
        try:
            return date.fromisoformat(str(raw))
        except ValueError:
            problems.append(f"a valid {label}")
            return None

    start = parse("start_date", "start date")
    end = parse("end_date", "end date")
    if problems:
        return None, problems

    if end < start:
        return None, ["an end date on or after the start date"]
    if start < date.today():
        return None, ["a start date that is not in the past"]

    days = working_days(start, end)
    if days == 0:
        return None, ["dates that include at least one working day"]
    if leave_type == "annual":
        remaining = get_balance(user)["remaining"]
        if days > remaining:
            return None, [f"fewer days - you asked for {days} working days but only have {remaining} annual days left"]

    reason = (params.get("reason") or "").strip()[:MAX_REASON]
    return {
        "leave_type": leave_type,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days": days,
        "reason": reason,
    }, []


def create_leave_request(user, clean: dict) -> LeaveRequest:
    return LeaveRequest.objects.create(
        user=user,
        leave_type=clean["leave_type"],
        start_date=date.fromisoformat(clean["start_date"]),
        end_date=date.fromisoformat(clean["end_date"]),
        days=clean["days"],
        reason=clean.get("reason", ""),
    )

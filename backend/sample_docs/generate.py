"""Generates fictional company documents (PDF + DOCX) used for the demo and the evaluation set."""
from pathlib import Path

import pymupdf as fitz
from docx import Document as Docx

LEAVE_P1 = """Northwind Labs - Leave Policy

1. Annual leave
Full-time employees receive 20 days of paid annual leave per calendar year. Leave accrues monthly.
Up to 5 unused days may be carried over into the next year. Carried-over days expire on 31 March.

2. Requesting leave
Leave longer than 2 days must be requested at least 5 working days in advance through the HR portal.
Your line manager approves or declines within 3 working days."""

LEAVE_P2 = """3. Sick leave
Employees receive 10 days of paid sick leave per year. A medical certificate is required for absences
longer than 2 consecutive days.

4. Parental leave
Maternity leave is 16 weeks paid. Paternity leave is 4 weeks paid and must be taken within 6 months of the birth.

5. Public holidays
The company observes 12 public holidays per year. The list is published every December."""

HANDBOOK_P1 = """Northwind Labs - Employee Handbook

Working hours
Standard working hours are 9:30 to 18:00, Monday to Friday. We work a hybrid model: employees are in the
office 3 days per week, and teams agree on their anchor days.

Probation
New employees complete a 3 month probation period with a review at the end of month 2."""

HANDBOOK_P2 = """Performance reviews
Performance reviews happen twice a year, in June and December.

Learning budget
Every employee has a learning budget of 1,000 USD per year for courses, books and conferences.

Working abroad
Employees may work remotely from another country for up to 20 days per year with manager approval."""

COMP_P1 = """CONFIDENTIAL - Executive Compensation Bands (admins only)

Band E1 salary range: 180,000 to 220,000 USD per year.
Band E2 salary range: 220,000 to 290,000 USD per year.
Annual bonus target for E1 is 15 percent of base salary."""


def _pdf(path: Path, pages: list[str]) -> None:
    pdf = fitz.open()
    for text in pages:
        page = pdf.new_page()
        page.insert_textbox(fitz.Rect(54, 54, 541, 780), text, fontsize=11, fontname="helv")
    pdf.save(str(path))


def _laptop_docx(path: Path) -> None:
    d = Docx()
    d.add_heading("Laptop Request Procedure", level=0)
    d.add_heading("Eligibility", level=1)
    d.add_paragraph("All full-time employees are eligible for a company laptop. Laptops are replaced after 36 months.")
    d.add_heading("How to request a laptop", level=1)
    for step in [
        "Open a ticket on the IT Service Desk portal under Hardware > Laptop request.",
        "Choose the standard model (14-inch, 16 GB RAM) or the developer model (16-inch, 32 GB RAM).",
        "Get approval from your line manager.",
        "IT delivers the laptop within 7 working days.",
    ]:
        d.add_paragraph(step, style="List Number")
    d.add_heading("Lost or stolen devices", level=1)
    d.add_paragraph("Report a lost or stolen laptop to IT within 24 hours and file a police report.")
    d.save(str(path))


def generate(out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    _pdf(out_dir / "Leave_Policy.pdf", [LEAVE_P1, LEAVE_P2])
    _pdf(out_dir / "Employee_Handbook.pdf", [HANDBOOK_P1, HANDBOOK_P2])
    _laptop_docx(out_dir / "Laptop_Request_Procedure.docx")
    _pdf(out_dir / "Executive_Compensation_Bands.pdf", [COMP_P1])
    return [
        {"path": out_dir / "Leave_Policy.pdf", "title": "Leave Policy", "access": "all"},
        {"path": out_dir / "Employee_Handbook.pdf", "title": "Employee Handbook", "access": "all"},
        {"path": out_dir / "Laptop_Request_Procedure.docx", "title": "Laptop Request Procedure", "access": "all"},
        {"path": out_dir / "Executive_Compensation_Bands.pdf", "title": "Executive Compensation Bands", "access": "admin"},
    ]

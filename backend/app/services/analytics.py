from __future__ import annotations

from collections import Counter
from datetime import date, timedelta

from ..models import Certification, Worker


def certification_status(certification: Certification, today: date | None = None) -> str:
    today = today or date.today()
    if certification.expiration_date is None:
        return "no-expiration"
    if certification.expiration_date < today:
        return "expired"
    if certification.expiration_date <= today + timedelta(days=30):
        return "expiring"
    return "valid"


def worker_certification_status(worker: Worker, today: date | None = None) -> str:
    today = today or date.today()
    if not worker.certifications:
        return "missing"

    statuses = [certification_status(certification, today) for certification in worker.certifications]
    if "expired" in statuses:
        return "expired"
    if "expiring" in statuses:
        return "expiring"
    if all(status == "no-expiration" for status in statuses):
        return "stable"
    return "valid"


def month_key(source_date: date | None) -> str:
    if source_date is None:
        return "Unknown"
    return source_date.strftime("%b %Y")


def build_onboarding_trend(workers: list[Worker]) -> list[dict[str, int | str]]:
    dated_workers = [worker.hire_date or worker.created_at.date() for worker in workers if worker.hire_date or worker.created_at]
    counts = Counter(source_date.replace(day=1) for source_date in dated_workers)
    sorted_items = sorted(counts.items(), key=lambda item: item[0])
    return [{"label": label.strftime("%b %Y"), "value": value} for label, value in sorted_items[-6:]]


def contractor_distribution(certifications: list[Certification]) -> list[dict[str, int | str]]:
    counts = Counter(certification.contractor or "Unassigned" for certification in certifications)
    return [{"label": label, "value": value} for label, value in counts.most_common(6)]


def certification_health(certifications: list[Certification]) -> list[dict[str, int | str]]:
    counts = Counter(certification_status(certification) for certification in certifications)
    ordered_labels = ["valid", "expiring", "expired", "no-expiration"]
    return [{"label": label, "value": counts.get(label, 0)} for label in ordered_labels]

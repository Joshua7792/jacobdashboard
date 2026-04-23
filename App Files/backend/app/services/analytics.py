from __future__ import annotations

from collections import Counter
from datetime import date

from ..models import TrainingCatalog, Worker, WorkerTraining


def training_status(training: WorkerTraining | None) -> str:
    if training and training.completed_on:
        return "completed"
    return "pending"


def month_key(source_date: date | None) -> str:
    if source_date is None:
        return "Unknown"
    return source_date.strftime("%b %Y")


def worker_compliance_counts(worker: Worker, total_required: int) -> dict[str, int | str]:
    completed = sum(1 for training in worker.trainings if training.completed_on)
    required = total_required
    pending = max(required - completed, 0)
    compliance_pct = round((completed / required) * 100) if required else 0

    if completed == 0:
        status = "missing"
    elif completed >= required:
        status = "complete"
    else:
        status = "partial"

    return {
        "completed": completed,
        "required": required,
        "pending": pending,
        "compliance_pct": compliance_pct,
        "status": status,
    }


def build_onboarding_trend(workers: list[Worker]) -> list[dict[str, int | str]]:
    dated_workers = [
        worker.hire_date or worker.created_at.date()
        for worker in workers
        if worker.hire_date or worker.created_at
    ]
    counts = Counter(source_date.replace(day=1) for source_date in dated_workers)
    sorted_items = sorted(counts.items(), key=lambda item: item[0])
    return [{"label": label.strftime("%b %Y"), "value": value} for label, value in sorted_items[-6:]]


def contractor_compliance_chart(
    workers: list[Worker],
    catalog_items: list[TrainingCatalog],
) -> list[dict[str, int | str]]:
    total_required = len(catalog_items)
    counts: dict[str, tuple[int, int]] = {}
    for worker in workers:
        contractor_name = worker.contractor.name if worker.contractor else "Unassigned"
        summary = worker_compliance_counts(worker, total_required)
        completed, required = counts.get(contractor_name, (0, 0))
        counts[contractor_name] = (
            completed + int(summary["completed"]),
            required + int(summary["required"]),
        )

    rows = []
    for contractor_name, (completed, required) in counts.items():
        pct = round((completed / required) * 100) if required else 0
        rows.append({"label": contractor_name, "value": pct})
    return sorted(rows, key=lambda row: (-int(row["value"]), str(row["label"])))[:8]


def training_coverage_chart(
    workers: list[Worker],
    catalog_items: list[TrainingCatalog],
) -> list[dict[str, int | str]]:
    coverage = []
    for catalog_item in catalog_items:
        completed = sum(
            1
            for worker in workers
            for training in worker.trainings
            if training.catalog_id == catalog_item.id and training.completed_on
        )
        coverage.append({"label": catalog_item.name, "value": completed})
    return sorted(coverage, key=lambda row: (-int(row["value"]), str(row["label"])))[:8]

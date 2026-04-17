from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_BACKEND_DIR = Path(__file__).resolve().parent.parent

if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent / "jacob-dashboard-data"
else:
    APP_DIR = PROJECT_BACKEND_DIR

BASE_DIR = PROJECT_BACKEND_DIR
DATA_DIR = APP_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DATABASE_PATH = DATA_DIR / "workforce_dashboard.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class Base(DeclarativeBase):
    pass


engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def _table_names(connection) -> set[str]:
    rows = connection.execute(
        text("SELECT name FROM sqlite_master WHERE type = 'table'")
    ).fetchall()
    return {row[0] for row in rows}


def _column_names(connection, table_name: str) -> set[str]:
    rows = connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {row[1] for row in rows}


def ensure_schema() -> None:
    with engine.begin() as connection:
        tables = _table_names(connection)

        if "companies" in tables:
            company_columns = _column_names(connection, "companies")
            if "budget_cap" not in company_columns:
                connection.execute(
                    text("ALTER TABLE companies ADD COLUMN budget_cap INTEGER DEFAULT 200000000")
                )
            connection.execute(
                text("UPDATE companies SET budget_cap = 200000000 WHERE budget_cap IS NULL")
            )

        if "contractors" in tables:
            contractor_columns = _column_names(connection, "contractors")
            if "budget_allocated" not in contractor_columns:
                connection.execute(
                    text("ALTER TABLE contractors ADD COLUMN budget_allocated INTEGER DEFAULT 0")
                )
            connection.execute(
                text("UPDATE contractors SET budget_allocated = 0 WHERE budget_allocated IS NULL")
            )

        if "workers" in tables:
            worker_columns = _column_names(connection, "workers")
            if "contractor_id" not in worker_columns:
                connection.execute(text("ALTER TABLE workers ADD COLUMN contractor_id INTEGER"))
            if "onboarding_status" not in worker_columns:
                connection.execute(
                    text("ALTER TABLE workers ADD COLUMN onboarding_status VARCHAR(40) DEFAULT 'active'")
                )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_workers_contractor_id ON workers (contractor_id)")
            )

        if "source_documents" in tables:
            source_document_columns = _column_names(connection, "source_documents")
            if "stored_file_name" not in source_document_columns:
                connection.execute(text("ALTER TABLE source_documents ADD COLUMN stored_file_name VARCHAR(255)"))

        if "worker_trainings" in tables:
            worker_training_columns = _column_names(connection, "worker_trainings")
            if "evidence_file_name" not in worker_training_columns:
                connection.execute(
                    text("ALTER TABLE worker_trainings ADD COLUMN evidence_file_name VARCHAR(255)")
                )
            if "evidence_stored_name" not in worker_training_columns:
                connection.execute(
                    text("ALTER TABLE worker_trainings ADD COLUMN evidence_stored_name VARCHAR(255)")
                )
            if "evidence_file_type" not in worker_training_columns:
                connection.execute(
                    text("ALTER TABLE worker_trainings ADD COLUMN evidence_file_type VARCHAR(120)")
                )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_catalog "
                    "ON worker_trainings (worker_id, catalog_id)"
                )
            )


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

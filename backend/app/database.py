from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import sys

from sqlalchemy import create_engine, inspect, text
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


def ensure_schema() -> None:
    inspector = inspect(engine)

    with engine.begin() as connection:
        tables = set(inspector.get_table_names())

        if "contractors" not in tables:
            connection.execute(
                text(
                    """
                    CREATE TABLE contractors (
                        id INTEGER PRIMARY KEY,
                        company_id INTEGER NOT NULL,
                        name VARCHAR(150) NOT NULL,
                        primary_contact VARCHAR(120),
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_contractors_id ON contractors (id)"))
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_contractors_company_id ON contractors (company_id)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_contractors_name ON contractors (name)")
            )

        worker_columns = {column["name"] for column in inspector.get_columns("workers")}
        if "contractor_id" not in worker_columns:
            connection.execute(text("ALTER TABLE workers ADD COLUMN contractor_id INTEGER"))
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_workers_contractor_id ON workers (contractor_id)")
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

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIST = FRONTEND_DIR / "dist"


def run(command: list[str], cwd: Path) -> None:
    completed = subprocess.run(command, cwd=cwd)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main() -> None:
    if not FRONTEND_DIST.exists():
        print("Frontend build not found. Building the app now...")
        run(["npm", "run", "build"], FRONTEND_DIR)

    print("Starting the desktop dashboard...")
    if not getattr(sys, "frozen", False):
        backend_path = str(BACKEND_DIR)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
    from app.desktop import main as run_desktop

    run_desktop()


if __name__ == "__main__":
    main()

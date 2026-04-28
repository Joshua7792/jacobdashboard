"""Desktop launcher for the Cordillera Workforce Dashboard.

Run this file to open the app in a native desktop window:

    python "App Files/launch_dashboard.py"

What it does:
  1. Builds the React frontend if no ``frontend/dist`` is present yet.
  2. Imports ``app.desktop`` from the backend, which boots a local FastAPI
     server on a free port and opens a pywebview window pointing at it.

Yes, you need this file — it is what wires the Python backend and the React
frontend together as a single double-clickable app.
"""
from __future__ import annotations

import platform
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIST = FRONTEND_DIR / "dist"


def run(command: list[str], cwd: Path) -> None:
    """Run a subprocess and propagate its non-zero exit code as SystemExit."""
    completed = subprocess.run(command, cwd=cwd)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main() -> None:
    if not FRONTEND_DIST.exists():
        print("Frontend build not found. Building the app now...")
        # Windows resolves npm via the .cmd shim; macOS / Linux use plain npm.
        npm = "npm.cmd" if platform.system() == "Windows" else "npm"
        run([npm, "run", "build"], FRONTEND_DIR)

    print("Starting the desktop dashboard...")
    # When PyInstaller bundles the app, sys.frozen is True and the backend
    # package is already on sys.path. In dev we add it manually.
    if not getattr(sys, "frozen", False):
        backend_path = str(BACKEND_DIR)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)

    from app.desktop import main as run_desktop

    run_desktop()


if __name__ == "__main__":
    main()

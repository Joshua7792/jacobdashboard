from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
BACKEND_DIR = ROOT_DIR / "backend"
DIST_DIR = ROOT_DIR / "dist"
BUILD_DIR = ROOT_DIR / "build"


def run(command: list[str], cwd: Path | None = None) -> None:
    completed = subprocess.run(command, cwd=cwd or ROOT_DIR)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main() -> None:
    print("Building frontend bundle...")
    run(["npm", "run", "build"], FRONTEND_DIR)

    print("Preparing clean packaging directories...")
    shutil.rmtree(DIST_DIR, ignore_errors=True)
    shutil.rmtree(BUILD_DIR, ignore_errors=True)

    print("Packaging desktop application...")
    run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--windowed",
            "--name",
            "JacobWorkforceDashboard",
            "--paths",
            str(BACKEND_DIR),
            "--add-data",
            f"{FRONTEND_DIR / 'dist'}:frontend/dist",
            str(ROOT_DIR / "launch_dashboard.py"),
        ]
    )

    print(f"Desktop build ready in {DIST_DIR / 'JacobWorkforceDashboard'}")


if __name__ == "__main__":
    main()

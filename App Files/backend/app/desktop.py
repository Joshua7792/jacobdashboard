"""Desktop runtime: boots FastAPI in a thread and opens a pywebview window.

The launcher (``launch_dashboard.py``) imports ``main()`` from this module.
We pick a free local port, start uvicorn on it in a background thread, wait
for the API health endpoint to respond, then create a pywebview window
pointing at it. The window IS the app.
"""
from __future__ import annotations

import os
import socket
import threading
import time
from urllib.request import urlopen

import uvicorn

from .main import app as fastapi_app


def reserve_port() -> int:
    """Ask the OS for a free localhost port. Avoids hard-coded clashes."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def run_api(port: int) -> None:
    """Run uvicorn synchronously — call from a daemon thread."""
    uvicorn.run(fastapi_app, host="127.0.0.1", port=port, reload=False)


def wait_for_api(port: int, timeout_seconds: float = 12.0) -> None:
    """Poll /api/health until it responds, or give up after the timeout.

    Without this, pywebview would open the window before uvicorn finishes
    binding the socket and the user would see a broken initial load.
    """
    deadline = time.time() + timeout_seconds
    health_url = f"http://127.0.0.1:{port}/api/health"
    while time.time() < deadline:
        try:
            with urlopen(health_url, timeout=1.0) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Desktop API did not become ready in time")


def main() -> None:
    """Entry point invoked from launch_dashboard.py."""
    try:
        import webview
    except ImportError as exc:
        raise SystemExit(
            "pywebview is not installed. Run `pip install -r backend/requirements.txt`."
        ) from exc

    port = reserve_port()
    # The port is exported for any subprocess that needs to know which API to
    # talk to (kept for parity with the frozen build).
    os.environ["CORDILLERA_DASHBOARD_PORT"] = str(port)

    api_thread = threading.Thread(target=run_api, args=(port,), daemon=True)
    api_thread.start()
    wait_for_api(port)

    window = webview.create_window(
        "Cordillera Workforce Dashboard",
        f"http://127.0.0.1:{port}",
        min_size=(1200, 780),
        text_select=True,
        fullscreen=True,
    )

    # F11 toggles fullscreen so the user can drop back to a normal window
    # (and reach the OS close button) without killing the process.
    def toggle_fullscreen() -> None:
        window.toggle_fullscreen()

    def bind_keys() -> None:
        window.evaluate_js(
            """
            document.addEventListener('keydown', (e) => {
              if (e.key === 'F11') {
                e.preventDefault();
                window.pywebview.api.toggle_fullscreen();
              }
            });
            """
        )

    window.expose(toggle_fullscreen)
    window.events.loaded += bind_keys
    webview.start()


if __name__ == "__main__":
    main()

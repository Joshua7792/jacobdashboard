from __future__ import annotations

import os
import socket
import threading
import time
from urllib.request import urlopen

import uvicorn

from .main import app as fastapi_app


def reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def run_api(port: int) -> None:
    uvicorn.run(fastapi_app, host="127.0.0.1", port=port, reload=False)


def wait_for_api(port: int, timeout_seconds: float = 12.0) -> None:
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
    try:
        import webview
    except ImportError as exc:
        raise SystemExit("pywebview is not installed. Run `pip install -r backend/requirements.txt`.") from exc

    port = reserve_port()
    os.environ["JACOB_DASHBOARD_PORT"] = str(port)
    api_thread = threading.Thread(target=run_api, args=(port,), daemon=True)
    api_thread.start()
    wait_for_api(port)

    webview.create_window(
        "Jacob Workforce Dashboard",
        f"http://127.0.0.1:{port}",
        min_size=(1200, 780),
        text_select=True,
    )
    webview.start()


if __name__ == "__main__":
    main()

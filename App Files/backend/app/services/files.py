from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..database import UPLOAD_DIR


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", filename).strip("-")
    return cleaned or "attachment"


async def save_upload(file: UploadFile) -> tuple[str, str]:
    original_name = file.filename or "document"
    safe_name = sanitize_filename(original_name)
    stored_name = f"{uuid4().hex}-{safe_name}"
    destination = Path(UPLOAD_DIR) / stored_name

    with destination.open("wb") as output:
        output.write(await file.read())

    return stored_name, original_name

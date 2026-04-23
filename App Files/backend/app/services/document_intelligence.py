from __future__ import annotations

import re
import logging
from datetime import date, datetime
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader

logging.getLogger("pypdf").setLevel(logging.ERROR)

KNOWN_TITLES = [
    "OSHA 10",
    "OSHA 30",
    "NFPA 70E",
    "Confined Space",
    "Fall Protection",
    "Lift Training",
    "Forklift",
    "Rigging",
    "First Aid",
    "CPR",
    "Scaffold",
]

TITLE_ALIASES = {
    "osha10": "OSHA 10",
    "osha30": "OSHA 30",
    "nfpa70e": "NFPA 70E",
    "confinedspace": "Confined Space",
    "fallprotection": "Fall Protection",
    "lifttraining": "Lift Training",
    "forklift": "Forklift",
    "rigging": "Rigging",
    "firstaid": "First Aid",
    "cpr": "CPR",
    "scaffold": "Scaffold",
}

DATE_PATTERNS = [
    r"\b\d{4}-\d{2}-\d{2}\b",
    r"\b\d{1,2}/\d{1,2}/\d{4}\b",
    r"\b\d{4}\s\d{2}\s\d{2}\b",
]

EXPIRATION_KEYWORDS = r"(?:expiration|expires?|valid\s+until|expiry)"
ISSUE_KEYWORDS = r"(?:issue\s+date|issued|completed|completion\s+date|date\s+issued)"


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_date(raw_value: str) -> date | None:
    normalized_value = raw_value.replace(" ", "-")
    for parser in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            parsed = datetime.strptime(normalized_value, parser)
            if parsed.year < 2000:
                parsed = parsed.replace(year=parsed.year + 2000)
            return parsed.date()
        except ValueError:
            continue
    return None


def extract_dates(text: str) -> list[date]:
    dates: list[date] = []
    for pattern in DATE_PATTERNS:
        for match in re.findall(pattern, text):
            parsed = parse_date(match)
            if parsed is not None:
                dates.append(parsed)
    return sorted(set(dates))


def extract_keyword_date(text: str, keyword_pattern: str) -> date | None:
    pattern = rf"{keyword_pattern}[^\d]{{0,20}}(\d{{4}}-\d{{2}}-\d{{2}}|\d{{1,2}}/\d{{1,2}}/\d{{4}})"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
        return parse_date(match.group(1))
    return None


def infer_title(text: str, filename: str) -> str | None:
    normalized_text = normalize_text(text).lower()
    for title in KNOWN_TITLES:
        if title.lower() in normalized_text:
            return title

    compact_text = re.sub(r"[^a-z0-9]+", "", normalized_text)
    for alias, title in TITLE_ALIASES.items():
        if alias in compact_text:
            return title

    cleaned_name = Path(filename).stem.replace("-", " ").replace("_", " ")
    tokens = [token.capitalize() for token in cleaned_name.split() if token]
    if not tokens:
        return None
    return " ".join(tokens[:4])


def infer_contractor(text: str, filename: str, title: str | None) -> str | None:
    match = re.search(
        r"(?:contractor|client|company|customer|for)\s*[:\-]\s*([A-Za-z0-9&.,' ]{3,80})",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return normalize_text(match.group(1))

    cleaned_name = Path(filename).stem
    cleaned_name = re.sub(r"\d{4}[-_/]\d{2}[-_/]\d{2}", " ", cleaned_name)
    cleaned_name = re.sub(r"\d{1,2}[-_/]\d{1,2}[-_/]\d{4}", " ", cleaned_name)
    cleaned_name = cleaned_name.replace("_", " ").replace("-", " ")
    cleaned_name = normalize_text(cleaned_name)

    if title:
        title_words = {word for word in re.findall(r"[a-z0-9]+", title.lower()) if word}
        title_words.add(re.sub(r"[^a-z0-9]+", "", title.lower()))
        remaining_words = [
            word
            for word in re.findall(r"[a-z0-9]+", cleaned_name.lower())
            if word not in title_words and not word.isdigit()
        ]
        if remaining_words:
            return " ".join(word.capitalize() for word in remaining_words)
    return None


def read_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages[:6]]
    return normalize_text(" ".join(pages))


def analyze_document(file_bytes: bytes, filename: str, content_type: str | None) -> dict[str, object]:
    suffix = Path(filename).suffix.lower()
    source = "filename"
    extracted_text = ""

    if content_type == "application/pdf" or suffix == ".pdf":
        try:
            extracted_text = read_pdf_text(file_bytes)
            source = "pdf-text"
        except Exception:
            extracted_text = ""

    working_text = extracted_text or normalize_text(Path(filename).stem.replace("-", " ").replace("_", " "))
    all_dates = extract_dates(working_text)
    issue_date = extract_keyword_date(working_text, ISSUE_KEYWORDS)
    expiration_date = extract_keyword_date(working_text, EXPIRATION_KEYWORDS)

    if issue_date is None and all_dates:
        issue_date = all_dates[0]
    if expiration_date is None and len(all_dates) > 1:
        expiration_date = all_dates[-1]
        if issue_date and expiration_date == issue_date and len(all_dates) > 1:
            expiration_date = all_dates[-2]

    title = infer_title(working_text, filename)
    contractor = infer_contractor(working_text, filename, title)
    preview = working_text[:700] if working_text else None

    return {
        "detected_title": title,
        "detected_contractor": contractor,
        "detected_issue_date": issue_date,
        "detected_expiration_date": expiration_date,
        "text_preview": preview,
        "analysis_source": source,
    }

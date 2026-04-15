from __future__ import annotations

import re
import subprocess
import tempfile
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from pypdf import PdfReader


PAGE_ONE_COLUMNS = [
    (39, "Protección Contra Caídas"),
    (51, "Flama Expuesta"),
    (62, "Espacios Confinados"),
    (77, "Manejo de Equipo Motorizado"),
    (92, "Excavación o Zanja"),
    (104, "Manejo de Tijeras (Scissor lift)"),
    (116, "Seguridad Eléctrica"),
    (128, "Lockout"),
    (140, "Manejo de Grúas"),
    (152, "Escaleras"),
    (164, "Andamios"),
    (176, "Trabajos con Plomo o Asbesto"),
    (188, "Comunicación de Riesgos"),
]

PAGE_TWO_COLUMNS = [
    (47, "Jacobs/Lilly Inducción"),
    (63, "OSHA 10"),
    (79, "OSHA 30"),
    (93, "Rebar Safety"),
    (105, "Formwork & Shoring"),
    (118, "Silica Exposure"),
    (133, "Concrete & Mansory"),
]

FULL_DATE_PATTERN = re.compile(r"\d{1,2}/\d{1,2}/\d{4}")
PARTIAL_DATE_PATTERN = re.compile(r"\d{1,2}/\d{1,2}/\d{3}$")
NAME_PATTERN = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]")


@dataclass
class MatrixEntry:
    employee_name: str
    title: str
    issue_date: date


@dataclass
class ParsedContractorMatrix:
    contractor_name: str
    completed_on: date | None
    analysis_source: str
    training_records: list[MatrixEntry]
    certifications: list[MatrixEntry]


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(char for char in normalized if not unicodedata.combining(char))
    ascii_only = re.sub(r"[^A-Za-z0-9 ]+", " ", ascii_only).lower()
    return re.sub(r"\s+", " ", ascii_only).strip()


def parse_mmddyyyy(raw_value: str) -> date:
    return datetime.strptime(raw_value, "%m/%d/%Y").date()


def contractor_alias(value: str) -> str:
    lowered = normalize_name(value)
    if "cornerstone" in lowered:
        return "Cornerstone"
    if "geoenvirotech" in lowered or "geo envirotech" in lowered:
        return "GeoEnvirotech"
    return value.strip()


def extract_pages(file_bytes: bytes, filename: str) -> tuple[list[str], str]:
    suffix = Path(filename).suffix or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(file_bytes)
        temp_path = Path(handle.name)

    try:
        try:
            completed = subprocess.run(
                ["pdftotext", "-layout", str(temp_path), "-"],
                check=True,
                capture_output=True,
                text=True,
            )
            return completed.stdout.split("\f"), "pdftotext-layout"
        except (FileNotFoundError, subprocess.CalledProcessError):
            reader = PdfReader(str(temp_path))
            pages = [page.extract_text() or "" for page in reader.pages]
            return pages, "pypdf-text"
    finally:
        temp_path.unlink(missing_ok=True)


def parse_contractor(page_text: str) -> str:
    match = re.search(r"Nombre de la compañía contratista:\s*(.+?)\s+\*?\s*Fecha de completado", page_text)
    if not match:
        raise ValueError("Could not detect contractor name in the document")
    return contractor_alias(match.group(1).strip())


def parse_completed_on(page_text: str) -> date | None:
    match = re.search(r"Fecha de completado.*?:\s*(\d{1,2}/\d{1,2}/\d{4})", page_text)
    if not match:
        return None
    return parse_mmddyyyy(match.group(1))


def strip_table_section(page_text: str, start_marker: str) -> list[str]:
    start_index = page_text.find(start_marker)
    if start_index == -1:
        return []
    section = page_text[start_index:]
    end_marker = "Por este medio certifico"
    if end_marker in section:
        section = section.split(end_marker, 1)[0]
    return section.splitlines()


def extract_name_from_line(line: str) -> str | None:
    leading_spaces = len(line) - len(line.lstrip(" "))
    if leading_spaces > 12:
        return None

    first_date = re.search(r"\d{1,2}/\d{1,2}/\d{3,4}", line)
    name_candidate = line[: first_date.start()] if first_date else line
    name_candidate = re.sub(r"\s+", " ", name_candidate).strip()
    if len(name_candidate.split()) < 2:
        return None
    lowered = name_candidate.lower()
    if any(
        token in lowered
        for token in ("nombre del empleado", "programa", "anejo", "complete", "página", "adiestramiento")
    ):
        return None
    if not NAME_PATTERN.search(name_candidate):
        return None
    return name_candidate


def collect_date_tokens(lines: list[str]) -> list[tuple[int, str]]:
    partials: list[tuple[int, str]] = []
    digits: list[tuple[int, str]] = []
    fulls: list[tuple[int, str]] = []

    for line in lines:
        for match in FULL_DATE_PATTERN.finditer(line):
            fulls.append((match.start(), match.group(0)))
        partial_match = PARTIAL_DATE_PATTERN.search(line)
        if partial_match:
            partials.append((partial_match.start(), partial_match.group(0)))

        stripped = line.strip()
        if re.fullmatch(r"\d", stripped):
            digit_index = line.index(stripped)
            digits.append((digit_index, stripped))

    combined: list[tuple[int, str]] = list(fulls)
    used_digits: set[int] = set()
    for partial_index, partial_value in partials:
        digit_candidate_index = None
        digit_candidate_value = None
        for index, (digit_position, digit_value) in enumerate(digits):
            if index in used_digits:
                continue
            if abs(digit_position - (partial_index + len(partial_value))) <= 5:
                digit_candidate_index = index
                digit_candidate_value = digit_value
                break
        if digit_candidate_index is not None and digit_candidate_value is not None:
            used_digits.add(digit_candidate_index)
            combined.append((digits[digit_candidate_index][0], partial_value + digit_candidate_value))

    return combined


def map_dates_to_titles(tokens: list[tuple[int, str]], columns: list[tuple[int, str]]) -> list[tuple[str, date]]:
    mapped: list[tuple[str, date]] = []
    seen_titles: set[str] = set()
    for token_position, token_value in tokens:
        try:
            parsed_date = parse_mmddyyyy(token_value)
        except ValueError:
            continue

        anchor, title = min(columns, key=lambda item: abs(item[0] - token_position))
        if abs(anchor - token_position) <= 8 and title not in seen_titles:
            mapped.append((title, parsed_date))
            seen_titles.add(title)
    return mapped


def parse_page_one(page_text: str) -> list[MatrixEntry]:
    lines = strip_table_section(page_text, "Nombre del Empleado")
    records: list[MatrixEntry] = []
    current_block: list[str] = []

    def flush_block() -> None:
        nonlocal current_block
        if not current_block:
            return
        name = extract_name_from_line(current_block[0])
        if not name:
            current_block = []
            return
        tokens = collect_date_tokens(current_block)
        for title, issue_date in map_dates_to_titles(tokens, PAGE_ONE_COLUMNS):
            records.append(MatrixEntry(employee_name=name, title=title, issue_date=issue_date))
        current_block = []

    for line in lines:
        if not line.strip():
            flush_block()
            continue

        if current_block:
            current_block.append(line)
            continue

        if extract_name_from_line(line):
            current_block = [line]

    flush_block()
    return records


def parse_page_two(page_text: str) -> list[MatrixEntry]:
    lines = strip_table_section(page_text, "Nombre del Empleado")
    records: list[MatrixEntry] = []
    pending_dates_line: str | None = None

    def append_records(name: str, line_with_dates: str) -> None:
        tokens = [(match.start(), match.group(0)) for match in FULL_DATE_PATTERN.finditer(line_with_dates)]
        for title, issue_date in map_dates_to_titles(tokens, PAGE_TWO_COLUMNS):
            records.append(MatrixEntry(employee_name=name, title=title, issue_date=issue_date))

    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            index += 1
            continue

        name = extract_name_from_line(line)
        dates_in_line = FULL_DATE_PATTERN.findall(line)

        if name and dates_in_line:
            append_records(name, line)
            index += 1
            continue

        if dates_in_line and not name:
            pending_dates_line = line
            index += 1
            continue

        if name and pending_dates_line:
            append_records(name, pending_dates_line)
            pending_dates_line = None
            index += 1
            continue

        index += 1

    return records


def parse_contractor_matrix(file_bytes: bytes, filename: str) -> ParsedContractorMatrix:
    pages, source = extract_pages(file_bytes, filename)
    if len(pages) < 2:
        raise ValueError("Expected a two-page contractor matrix PDF")

    contractor_name = parse_contractor(pages[0])
    completed_on = parse_completed_on(pages[0])
    training_records = parse_page_one(pages[0])
    certifications = parse_page_two(pages[1])

    if not training_records and not certifications:
        raise ValueError("The PDF did not produce any importable training or certification records")

    return ParsedContractorMatrix(
        contractor_name=contractor_name,
        completed_on=completed_on,
        analysis_source=source,
        training_records=training_records,
        certifications=certifications,
    )

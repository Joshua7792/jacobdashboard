"""Import a contractor certification PDF (Anejo 3 format) into the Excel tracker.

Usage:
    python tools/import_pdf.py "path/to/file.pdf" [more.pdf ...]

Or drag a PDF onto Import PDF.bat in the project root.

Rules:
- Contractor name is read from "Nombre de la compañía contratista: X".
- Workers are matched by normalized name (accent/case insensitive) within a contractor.
- New workers are appended; existing workers keep the most recent date per cert.
- New contractors are added to the Contractors sheet automatically.
"""
from __future__ import annotations

import os
import re
import sys
import unicodedata
from copy import copy
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pdfplumber
from openpyxl.formatting.rule import FormulaRule
from openpyxl import load_workbook
from openpyxl.styles import PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = ROOT / "Contractor Certifications Tracker.xlsx"


# --- Normalization ---
def normalize(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\s+", " ", s)
    return s


# --- Date parsing ---
MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

EXTRA_ADDITIONAL_CERTS = [
    ("OSHA 10", 0),
    ("OSHA 30", 0),
    ("Rebar Safety", 0),
    ("Formwork & Shoring", 0),
    ("Silica Exposure", 0),
    ("Concrete & Masonry", 0),
]

PAGE2_HEADER_ALIASES = {
    "induccion jacobs/lilly": "Inducción Jacobs/Lilly",
    "induccion jacobs lilly": "Inducción Jacobs/Lilly",
    "osha10": "OSHA 10",
    "osha 10": "OSHA 10",
    "osha30": "OSHA 30",
    "osha 30": "OSHA 30",
    "rebar safety": "Rebar Safety",
    "formwork & shoring": "Formwork & Shoring",
    "formwork and shoring": "Formwork & Shoring",
    "formwork shoring": "Formwork & Shoring",
    "silica exposure": "Silica Exposure",
    "concrete & masonry": "Concrete & Masonry",
    "concrete and masonry": "Concrete & Masonry",
    "concrete masonry": "Concrete & Masonry",
    "concrete & mansory": "Concrete & Masonry",
    "concrete mansory": "Concrete & Masonry",
}

DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{4}")


def parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    s = s.replace("\n", " ").strip()
    slash_compact = re.sub(r"\s+", "", s) if "/" in s else None

    candidates = [s]
    if slash_compact and slash_compact != s:
        candidates.append(slash_compact)

    for candidate in candidates:
        for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(candidate, fmt).date()
            except ValueError:
                pass

    for fmt in ("%B %Y", "%b %Y", "%B, %Y", "%b. %Y"):
        try:
            return datetime.strptime(s, fmt).date().replace(day=1)
        except ValueError:
            pass

    # Spanish "Enero 2008" / "enero de 2008"
    m = re.match(r"([a-záéíóúñ]+)[\s,]+(?:de\s+)?(\d{4})", s.lower())
    if m and m.group(1) in MONTHS_ES:
        return date(int(m.group(2)), MONTHS_ES[m.group(1)], 1)

    return None


# --- Cert name matching ---
def build_cert_alias_map(ws: Worksheet) -> dict[str, str]:
    """Map normalized cert header -> canonical cert name from Certifications sheet."""
    aliases = {}
    for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
        name = row[0]
        if not name:
            continue
        aliases[normalize(name)] = name
        # Add a few common variants
        compact = normalize(re.sub(r"[()]", "", name))
        aliases[compact] = name
    # Known alternate spellings
    extras = {
        "osha 40hr hozwoper": "OSHA 40Hr HAZWOPER",
        "osha 40 hr hazwoper": "OSHA 40Hr HAZWOPER",
        "osha40hr hazwoper": "OSHA 40Hr HAZWOPER",
        "osha 8hr refresher": "OSHA 8Hr Refresher",
        "osha8hr refresher": "OSHA 8Hr Refresher",
        "manejo de tijeras scissor lift": "Manejo de Tijeras (Scissor Lift)",
        "manejo de tijeras": "Manejo de Tijeras (Scissor Lift)",
        "scissor lift": "Manejo de Tijeras (Scissor Lift)",
        "excavacion o zanja": "Excavación o Zanja",
        "excavacion": "Excavación o Zanja",
        "trabajos con plomo o asbesto": "Trabajos con Plomo o Asbesto",
        "plomo o asbesto": "Trabajos con Plomo o Asbesto",
        "induccion jacobs lilly": "Inducción Jacobs/Lilly",
        "induccion jacobs/lilly": "Inducción Jacobs/Lilly",
        "induccion": "Inducción Jacobs/Lilly",
        "comunicacion de riesgos": "Comunicación de Riesgos",
        "proteccion contra caidas": "Protección Contra Caídas",
        "seguridad electrica": "Seguridad Eléctrica",
        "drilling safety": "Drilling Safety",
        "utility locating": "Utility Locating",
        "osha 10": "OSHA 10",
        "osha10": "OSHA 10",
        "osha 30": "OSHA 30",
        "osha30": "OSHA 30",
        "rebar safety": "Rebar Safety",
        "formwork & shoring": "Formwork & Shoring",
        "formwork and shoring": "Formwork & Shoring",
        "formwork shoring": "Formwork & Shoring",
        "silica exposure": "Silica Exposure",
        "concrete & masonry": "Concrete & Masonry",
        "concrete and masonry": "Concrete & Masonry",
        "concrete masonry": "Concrete & Masonry",
        "concrete & mansory": "Concrete & Masonry",
        "concrete mansory": "Concrete & Masonry",
    }
    for k, v in extras.items():
        aliases.setdefault(k, v)
    return aliases


STOPWORDS = {"de", "la", "el", "o", "y", "con", "por", "del", "las", "los", "a"}


def match_cert(header: str, aliases: dict[str, str]) -> Optional[str]:
    """Map a raw PDF header to a canonical cert name with fuzzy fallback."""
    key = normalize(header)
    if not key:
        return None
    if key in aliases:
        return aliases[key]
    # Remove parentheses and try again
    compact = normalize(re.sub(r"[()]", "", key))
    if compact in aliases:
        return aliases[compact]
    # Substring match (either direction)
    for norm_key, canonical in aliases.items():
        if len(norm_key) < 6:
            continue
        if norm_key in key or key in norm_key:
            return canonical
    # Token overlap
    key_tokens = set(key.split()) - STOPWORDS
    if not key_tokens:
        return None
    best_canonical = None
    best_score = 0
    for norm_key, canonical in aliases.items():
        tokens = set(norm_key.split()) - STOPWORDS
        if len(tokens) < 2:
            continue
        overlap = len(key_tokens & tokens)
        if overlap >= 2 and overlap > best_score:
            best_score = overlap
            best_canonical = canonical
    return best_canonical


# --- PDF extraction ---
def find_first_data_row(table: list[list], header_idx: int, name_col: int) -> int:
    for i in range(header_idx + 1, len(table)):
        row = table[i] or []
        if name_col >= len(row):
            continue
        worker_name = " ".join(str(row[name_col] or "").split()).strip()
        if worker_name and "nombre" not in normalize(worker_name):
            return i
    return min(header_idx + 1, len(table))


def build_table_header(table: list[list], header_idx: int, first_data_idx: int) -> list[str]:
    header_rows = table[header_idx:first_data_idx]
    width = max((len(row or []) for row in header_rows), default=0)
    combined: list[str] = []

    for col_idx in range(width):
        parts: list[str] = []
        for row in header_rows:
            if col_idx >= len(row):
                continue
            cell = " ".join(str(row[col_idx] or "").split()).strip()
            if not cell:
                continue
            if not parts or parts[-1] != cell:
                parts.append(cell)
        combined.append(" ".join(parts).strip())

    return combined


def value_for_cert_column(row: list, idx: int, header_name: str) -> Optional[str]:
    if idx < len(row) and row[idx] not in (None, ""):
        return row[idx]

    header_norm = normalize(header_name)
    if "manejo de tijeras" in header_norm:
        for alt_idx in (idx - 1, idx + 1, idx - 2, idx + 2):
            if alt_idx < 0 or alt_idx >= len(row):
                continue
            candidate = row[alt_idx]
            if parse_date(candidate):
                return candidate

    return None


def extract_contractor(text: str) -> Optional[str]:
    # Work on an accent-stripped copy for matching, but recover the original slice
    # so we keep accents in the final contractor name.
    ascii_text = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in ascii_text if not unicodedata.combining(c))

    patterns = [
        r"nombre\s+de\s+la\s+compa\S*\s+contratista\s*[:\-]?\s*([^\n*]+?)(?:\s*\*|\s*fecha|\s*pagina|\n|$)",
        r"compa\S*\s+contratista\s*[:\-]?\s*([^\n*]+?)(?:\s*\*|\s*fecha|\s*pagina|\n|$)",
        r"contratista\s*[:\-]\s*([^\n*]+?)(?:\s*\*|\s*fecha|\s*pagina|\n|$)",
        r"contractor\s*(?:name)?\s*[:\-]\s*([^\n*]+?)(?:\s*\*|\s*date|\n|$)",
    ]
    for pattern in patterns:
        m = re.search(pattern, ascii_text, flags=re.IGNORECASE)
        if m:
            start, end = m.span(1)
            # Pull the corresponding slice from the original text (indexes line up
            # because NFKD decomposition only *adds* combining marks; we stripped them)
            raw = text[start:end] if end <= len(text) else m.group(1)
            # If lengths drifted because of normalization edge cases, fall back
            if len(raw) < 2 or len(raw) > len(m.group(1)) + 10:
                raw = m.group(1)
            return raw.strip().rstrip(".,;")
    return None


def cleanup_primary_contact(raw: str) -> Optional[str]:
    """Rebuild a contact name when pdfplumber scatters letters across signature lines."""
    raw = re.split(r"\s{3,}|\t", raw)[0]
    raw = raw.replace("\r", " ").replace("\n", " ")
    raw = raw.strip().strip("_").strip().rstrip(".,;:")
    if not raw:
        return None

    if "_" not in raw:
        parts = raw.split()
        while parts and len(parts[-1]) <= 2 and parts[-1].islower():
            parts.pop()
        simple_name = " ".join(parts).strip()
        return simple_name or None

    fragments = list(re.finditer(r"[^\W\d_]+", raw, flags=re.UNICODE))
    if not fragments:
        return None

    words: list[str] = []
    current = fragments[0].group(0)
    prev_fragment = fragments[0].group(0)
    prev_end = fragments[0].end()

    for match in fragments[1:]:
        fragment = match.group(0)
        separator = raw[prev_end:match.start()]
        separator = separator.replace("\u00A0", " ")
        weak_join = False
        if " " in separator and len(current) >= 3 and fragment[:1].isupper():
            weak_join = False
        elif re.fullmatch(r"_+", separator):
            weak_join = True
        elif re.fullmatch(r"[ _]{1,2}", separator):
            weak_join = "_" in separator or (
                len(prev_fragment) <= 2 and len(fragment) <= 2
            )

        if weak_join:
            current += fragment
        else:
            words.append(current)
            current = fragment

        prev_fragment = fragment
        prev_end = match.end()

    words.append(current)

    cleaned_words = []
    for word in words:
        letters_only = re.sub(r"[^\w'-]", "", word, flags=re.UNICODE)
        letters_only = re.sub(r"[\d_]", "", letters_only)
        if not letters_only:
            continue
        if letters_only.islower() or letters_only.isupper():
            letters_only = letters_only.capitalize()
        cleaned_words.append(letters_only)

    if not cleaned_words or len(cleaned_words) > 6:
        return None

    return " ".join(cleaned_words)


def extract_primary_contact(text: str) -> Optional[str]:
    """Pull the name after 'Certificado por nombre/firma:'."""
    ascii_text = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in ascii_text if not unicodedata.combining(c))
    patterns = [
        r"certificado\s+por\s+nombre\s*/?\s*firma\s*[:\-_]*\s*([^\n]+)",
        r"nombre\s*/?\s*firma\s*[:\-_]*\s*([^\n]+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, ascii_text, flags=re.IGNORECASE)
        if not m:
            continue
        start, end = m.span(1)
        raw = text[start:end] if end <= len(text) else m.group(1)
        name = cleanup_primary_contact(raw)
        if not name:
            continue
        if 2 <= len(name) <= 80:
            return name
    return None


def merge_worker_certs(
    workers: dict[str, dict[str, date]],
    parsed: dict[str, dict[str, date]],
) -> None:
    for worker_name, certs in parsed.items():
        entry = workers.setdefault(worker_name, {})
        for cert_name, dt in certs.items():
            existing = entry.get(cert_name)
            if existing is None or dt > existing:
                entry[cert_name] = dt


def canonicalize_page2_header(label: str) -> Optional[str]:
    label = label.replace("\n", " ")
    label = label.replace("&", " & ")
    label = re.sub(r"\s+", " ", label).strip()
    key = normalize(label)
    return PAGE2_HEADER_ALIASES.get(key)


def extract_additional_training_page(page: pdfplumber.page.Page) -> dict[str, dict[str, date]]:
    words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
    if not words:
        return {}

    header_words = [
        w for w in words
        if 150 <= w["top"] <= 205 and w["x0"] >= 180 and not DATE_RE.fullmatch(w["text"])
    ]
    if not header_words:
        return {}

    x_groups: list[dict[str, object]] = []
    for word in sorted(header_words, key=lambda w: (w["x0"], w["top"])):
        if not x_groups or abs(word["x0"] - x_groups[-1]["x0"]) > 4:
            x_groups.append({"x0": word["x0"], "words": [word]})
        else:
            x_groups[-1]["words"].append(word)

    header_parts = []
    for group in x_groups:
        group_words = group["words"]
        label = "".join(w["text"] for w in sorted(group_words, key=lambda w: w["top"], reverse=True))
        header_parts.append(
            {
                "label": label,
                "x0": min(w["x0"] for w in group_words),
                "x1": max(w["x1"] for w in group_words),
            }
        )

    training_columns = []
    for part in header_parts:
        if not training_columns or part["x0"] - training_columns[-1]["x1"] > 18:
            training_columns.append({"parts": [part], "x0": part["x0"], "x1": part["x1"]})
        else:
            training_columns[-1]["parts"].append(part)
            training_columns[-1]["x1"] = part["x1"]

    column_defs = []
    for group in training_columns:
        raw_label = " ".join(part["label"] for part in group["parts"])
        canonical = canonicalize_page2_header(raw_label)
        if not canonical:
            continue
        column_defs.append(
            {
                "name": canonical,
                "center_x": (group["x0"] + group["x1"]) / 2,
            }
        )

    if DEBUG:
        print(f"  [debug] page 2 additional columns: {[c['name'] for c in column_defs]}")

    if not column_defs:
        return {}

    name_words = [
        w for w in words
        if 205 <= w["top"] <= 430 and w["x0"] < 180 and not DATE_RE.fullmatch(w["text"])
    ]
    if not name_words:
        return {}

    name_rows = []
    for word in sorted(name_words, key=lambda w: (w["top"], w["x0"])):
        if not name_rows or abs(word["top"] - name_rows[-1]["top"]) > 8:
            name_rows.append({"top": word["top"], "words": [word]})
        else:
            name_rows[-1]["words"].append(word)

    worker_rows = []
    for row in name_rows:
        row_words = sorted(row["words"], key=lambda w: w["x0"])
        worker_name = " ".join(w["text"] for w in row_words).strip()
        if not worker_name or "nombre del empleado" in normalize(worker_name):
            continue
        mids = [((w["top"] + w["bottom"]) / 2) for w in row_words]
        worker_rows.append(
            {
                "name": worker_name,
                "center_y": sum(mids) / len(mids),
            }
        )

    if not worker_rows:
        return {}

    parsed: dict[str, dict[str, date]] = {}
    date_words = [
        w for w in words
        if DATE_RE.fullmatch(w["text"]) and 205 <= w["top"] <= 430 and w["x0"] >= 180
    ]
    for word in date_words:
        center_y = (word["top"] + word["bottom"]) / 2
        worker_row = min(worker_rows, key=lambda row: abs(row["center_y"] - center_y))
        if abs(worker_row["center_y"] - center_y) > 20:
            continue

        center_x = (word["x0"] + word["x1"]) / 2
        training_col = min(column_defs, key=lambda col: abs(col["center_x"] - center_x))
        dt = parse_date(word["text"])
        if not dt:
            continue

        parsed.setdefault(worker_row["name"], {})[training_col["name"]] = dt

    return parsed


DEBUG = bool(os.environ.get("DEBUG_IMPORT"))


def extract_pdf_data(
    pdf_path: Path,
) -> tuple[Optional[str], Optional[str], dict[str, dict[str, date]]]:
    """Return (contractor_name, primary_contact, {worker_name: {cert_name: date}})."""
    contractor: Optional[str] = None
    primary_contact: Optional[str] = None
    workers: dict[str, dict[str, date]] = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if contractor is None:
                contractor = extract_contractor(text)
            if primary_contact is None:
                primary_contact = extract_primary_contact(text)

            if "nombre del adiestramiento" in normalize(text):
                merge_worker_certs(workers, extract_additional_training_page(page))
                continue

            # Try multiple extraction strategies - default first, then line-based
            strategies = [
                None,  # default
                {"vertical_strategy": "lines", "horizontal_strategy": "lines"},
                {"vertical_strategy": "text", "horizontal_strategy": "lines"},
            ]
            tables: list = []
            for strat in strategies:
                tables = page.extract_tables(table_settings=strat) if strat else page.extract_tables()
                if tables and any(
                    any("empleado" in normalize((c or "")) for c in (row or []))
                    for tbl in tables
                    for row in tbl
                ):
                    break

            for tbl_idx, table in enumerate(tables or []):
                if not table or len(table) < 2:
                    continue

                # Find header row: the row that contains "empleado"
                header_idx = None
                for i, row in enumerate(table):
                    if not row:
                        continue
                    if any("empleado" in normalize((c or "")) for c in row):
                        header_idx = i
                        break
                if header_idx is None:
                    continue

                header_row = [(c or "").strip() for c in table[header_idx]]
                name_col = next(
                    (i for i, h in enumerate(header_row) if "empleado" in normalize(h)),
                    0,
                )
                first_data_idx = find_first_data_row(table, header_idx, name_col)
                header = build_table_header(table, header_idx, first_data_idx)

                cert_cols: list[tuple[int, str]] = []
                for idx, h in enumerate(header):
                    if idx == name_col:
                        continue
                    h_norm = normalize(h)
                    if not h_norm:
                        continue
                    if "nombre" in h_norm or h_norm == "adiestramiento":
                        continue
                    cert_cols.append((idx, h))

                if DEBUG:
                    print(f"  [debug] page {page_num} table {tbl_idx}: header_idx={header_idx}")
                    print(f"  [debug]   name_col={name_col}, cert_cols={[(i, h[:30]) for i, h in cert_cols]}")

                for row in table[first_data_idx:]:
                    if not row or name_col >= len(row) or not row[name_col]:
                        continue
                    worker_name = " ".join((row[name_col] or "").split()).strip()
                    if not worker_name or "nombre" in normalize(worker_name):
                        continue
                    entry = workers.setdefault(worker_name, {})
                    for idx, header_name in cert_cols:
                        dt = parse_date(value_for_cert_column(row, idx, header_name))
                        if dt:
                            entry[header_name] = dt

    return contractor, primary_contact, workers


# --- Workbook helpers ---
def first_empty_row(ws: Worksheet, key_col: int = 1, start: int = 2, limit: int = 2000) -> int:
    for r in range(start, limit):
        if ws.cell(row=r, column=key_col).value in (None, ""):
            return r
    return limit


def find_row(ws: Worksheet, key_col: int, target_norm: str, start: int = 2, limit: int = 2000) -> Optional[int]:
    for r in range(start, limit):
        val = ws.cell(row=r, column=key_col).value
        if val in (None, ""):
            return None
        if normalize(str(val)) == target_norm:
            return r
    return None


def tracker_cert_columns(ws: Worksheet) -> dict[str, int]:
    """Map cert name (as in Tracker header row 2) -> column index."""
    mapping = {}
    for col in range(3, ws.max_column + 1):
        val = ws.cell(row=2, column=col).value
        if val:
            mapping[val] = col
    return mapping


def add_tracker_conditional_formatting(
    ws: Worksheet, start_col: int, end_col: int, last_row: int
) -> None:
    start_letter = get_column_letter(start_col)
    end_letter = get_column_letter(end_col)
    matrix_range = f"{start_letter}3:{end_letter}{last_row}"

    red_fill = PatternFill("solid", fgColor="F8CBAD")
    ws.conditional_formatting.add(
        matrix_range,
        FormulaRule(formula=[f'AND($B3<>"",{start_letter}3="")'], fill=red_fill, stopIfTrue=False),
    )

    orange_fill = PatternFill("solid", fgColor="F4B183")
    expired_formula = (
        f'AND({start_letter}3<>"",'
        f'ISNUMBER({start_letter}3),'
        f'VLOOKUP({start_letter}$2,Certifications!$A:$C,3,FALSE)>0,'
        f'EDATE({start_letter}3,VLOOKUP({start_letter}$2,Certifications!$A:$C,3,FALSE)*12)<TODAY())'
    )
    ws.conditional_formatting.add(
        matrix_range, FormulaRule(formula=[expired_formula], fill=orange_fill, stopIfTrue=False)
    )

    yellow_fill = PatternFill("solid", fgColor="FFE699")
    expiring_formula = (
        f'AND({start_letter}3<>"",'
        f'ISNUMBER({start_letter}3),'
        f'VLOOKUP({start_letter}$2,Certifications!$A:$C,3,FALSE)>0,'
        f'EDATE({start_letter}3,VLOOKUP({start_letter}$2,Certifications!$A:$C,3,FALSE)*12)>=TODAY(),'
        f'EDATE({start_letter}3,VLOOKUP({start_letter}$2,Certifications!$A:$C,3,FALSE)*12)<=TODAY()+60)'
    )
    ws.conditional_formatting.add(
        matrix_range, FormulaRule(formula=[expiring_formula], fill=yellow_fill, stopIfTrue=False)
    )

    green_fill = PatternFill("solid", fgColor="C6EFCE")
    current_formula = f'AND({start_letter}3<>"",ISNUMBER({start_letter}3))'
    ws.conditional_formatting.add(
        matrix_range, FormulaRule(formula=[current_formula], fill=green_fill, stopIfTrue=False)
    )


def ensure_required_certifications(ws_certs: Worksheet, ws_tracker: Worksheet) -> list[str]:
    existing_cert_names = {
        normalize(str(row[0])): row[0]
        for row in ws_certs.iter_rows(min_row=2, max_col=1, values_only=True)
        if row[0]
    }
    added = []
    for cert_name, validity in EXTRA_ADDITIONAL_CERTS:
        if normalize(cert_name) in existing_cert_names:
            continue
        row = first_empty_row(ws_certs, key_col=1, start=2, limit=max(ws_certs.max_row + 50, 200))
        ws_certs.cell(row=row, column=1, value=cert_name)
        ws_certs.cell(row=row, column=2, value="Additional Training")
        ws_certs.cell(row=row, column=3, value=validity)
        added.append(cert_name)

    current_columns = tracker_cert_columns(ws_tracker)
    missing_headers = [name for name, _ in EXTRA_ADDITIONAL_CERTS if name not in current_columns]
    if not missing_headers:
        return added

    last_existing_col = ws_tracker.max_column
    header_template = ws_tracker.cell(row=2, column=last_existing_col)
    data_template = ws_tracker.cell(row=3, column=last_existing_col)
    banner_start = next(
        (col for col in range(3, ws_tracker.max_column + 1) if ws_tracker.cell(row=1, column=col).value == "Additional Training"),
        3,
    )
    banner_template = ws_tracker.cell(row=1, column=banner_start)
    last_row = max(ws_tracker.max_row, 200)

    for offset, cert_name in enumerate(missing_headers, start=1):
        col = last_existing_col + offset
        header_cell = ws_tracker.cell(row=2, column=col, value=cert_name)
        header_cell._style = copy(header_template._style)

        width = ws_tracker.column_dimensions[get_column_letter(last_existing_col)].width
        ws_tracker.column_dimensions[get_column_letter(col)].width = width or 14

        for row in range(3, last_row + 1):
            cell = ws_tracker.cell(row=row, column=col)
            cell._style = copy(data_template._style)
            cell.number_format = "mm/dd/yyyy"

    for merged_range in list(ws_tracker.merged_cells.ranges):
        if (
            merged_range.min_row == 1
            and merged_range.max_row == 1
            and merged_range.min_col == banner_start
        ):
            ws_tracker.unmerge_cells(str(merged_range))
    ws_tracker.merge_cells(
        start_row=1,
        start_column=banner_start,
        end_row=1,
        end_column=ws_tracker.max_column,
    )
    banner_cell = ws_tracker.cell(row=1, column=banner_start, value="Additional Training")
    banner_cell._style = copy(banner_template._style)

    add_tracker_conditional_formatting(
        ws_tracker,
        last_existing_col + 1,
        ws_tracker.max_column,
        last_row,
    )
    return list(dict.fromkeys(added + missing_headers))


def find_tracker_row(
    ws: Worksheet, contractor: str, worker: str
) -> Optional[int]:
    c_norm = normalize(contractor)
    w_norm = normalize(worker)
    for r in range(3, 2000):
        wval = ws.cell(row=r, column=2).value
        if wval in (None, ""):
            return None
        cval = ws.cell(row=r, column=1).value or ""
        if normalize(str(wval)) == w_norm and normalize(str(cval)) == c_norm:
            return r
    return None


# --- Main import logic ---
def import_pdf(pdf_path: Path) -> dict:
    contractor, primary_contact, workers_data = extract_pdf_data(pdf_path)
    if not contractor:
        # Dump first 400 chars of extracted text so we can fix the regex
        with pdfplumber.open(pdf_path) as pdf:
            snippet = (pdf.pages[0].extract_text() or "")[:400]
        raise RuntimeError(
            f"Could not find contractor name in {pdf_path.name}.\n"
            f"--- First 400 chars of extracted text ---\n{snippet}\n"
            f"--- end ---"
        )
    if not workers_data:
        raise RuntimeError(f"No worker rows extracted from {pdf_path.name}")

    wb = load_workbook(WORKBOOK_PATH)
    ws_contractors = wb["Contractors"]
    ws_workers = wb["Workers"]
    ws_certs = wb["Certifications"]
    ws_tracker = wb["Tracker"]

    added_cert_columns = ensure_required_certifications(ws_certs, ws_tracker)

    alias_map = build_cert_alias_map(ws_certs)
    cert_columns = tracker_cert_columns(ws_tracker)

    stats = {
        "contractor": contractor,
        "primary_contact": primary_contact,
        "contractor_added": False,
        "contact_added": False,
        "workers_added": 0,
        "workers_existing": 0,
        "certs_updated": 0,
        "certs_unchanged": 0,
        "cert_columns_added": added_cert_columns,
        "unmatched_headers": set(),
    }

    # 1) Contractor + primary contact
    c_norm = normalize(contractor)
    c_row = find_row(ws_contractors, key_col=1, target_norm=c_norm)
    if c_row is None:
        c_row = first_empty_row(ws_contractors, key_col=1)
        ws_contractors.cell(row=c_row, column=1, value=contractor)
        stats["contractor_added"] = True

    # Fill primary contact if extracted and currently blank
    if primary_contact:
        contact_cell = ws_contractors.cell(row=c_row, column=2)
        if not contact_cell.value:
            contact_cell.value = primary_contact
            stats["contact_added"] = True

    # 2) Workers and tracker rows
    for worker, certs in workers_data.items():
        w_norm = normalize(worker)

        # Add worker to Workers sheet if not already present (under ANY contractor)
        existing_row = None
        for r in range(2, 2000):
            nm = ws_workers.cell(row=r, column=1).value
            if nm in (None, ""):
                break
            if normalize(str(nm)) == w_norm:
                existing_row = r
                break

        if existing_row is None:
            new_row = first_empty_row(ws_workers, key_col=1)
            ws_workers.cell(row=new_row, column=1, value=worker)
            ws_workers.cell(row=new_row, column=2, value=contractor)
            ws_workers.cell(row=new_row, column=4, value="active")
            stats["workers_added"] += 1
        else:
            stats["workers_existing"] += 1

        # Find or create tracker row for (contractor, worker)
        t_row = find_tracker_row(ws_tracker, contractor, worker)
        if t_row is None:
            t_row = first_empty_row(ws_tracker, key_col=2, start=3)
            ws_tracker.cell(row=t_row, column=1, value=contractor)
            ws_tracker.cell(row=t_row, column=2, value=worker)

        # Update cert dates (newer wins)
        for header_name, dt in certs.items():
            canonical = match_cert(header_name, alias_map)
            if not canonical or canonical not in cert_columns:
                stats["unmatched_headers"].add(header_name)
                continue
            col = cert_columns[canonical]
            cell = ws_tracker.cell(row=t_row, column=col)
            existing = cell.value
            if isinstance(existing, datetime):
                existing = existing.date()
            if existing is None or (isinstance(existing, date) and dt > existing):
                cell.value = dt
                cell.number_format = "mm/dd/yyyy"
                stats["certs_updated"] += 1
            else:
                stats["certs_unchanged"] += 1

    wb.save(WORKBOOK_PATH)
    return stats


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python import_pdf.py <file.pdf> [more.pdf ...]")
        return 1
    if not WORKBOOK_PATH.exists():
        print(f"Workbook not found at {WORKBOOK_PATH}. Run tools/build_cert_tracker.py first.")
        return 2

    any_success = False
    for arg in argv[1:]:
        pdf_path = Path(arg)
        if not pdf_path.exists():
            print(f"[SKIP] Not found: {pdf_path}")
            continue
        print(f"\n=== Importing: {pdf_path.name} ===")
        try:
            stats = import_pdf(pdf_path)
        except PermissionError:
            print(
                "[ERROR] Permission denied — the Excel file is open.\n"
                "        Close 'Contractor Certifications Tracker.xlsx' in Excel and try again."
            )
            continue
        except Exception as exc:
            print(f"[ERROR] {exc}")
            continue
        any_success = True
        print(f"  Contractor:        {stats['contractor']}"
              f"{' (NEW)' if stats['contractor_added'] else ''}")
        if stats["primary_contact"]:
            print(f"  Primary contact:   {stats['primary_contact']}"
                  f"{' (saved)' if stats['contact_added'] else ''}")
        else:
            print("  Primary contact:   (not detected in PDF)")
        print(f"  Workers added:     {stats['workers_added']}")
        print(f"  Workers existing:  {stats['workers_existing']}")
        if stats["cert_columns_added"]:
            print(f"  Cert columns added:{' ' if len(stats['cert_columns_added']) < 10 else ''}{', '.join(stats['cert_columns_added'])}")
        print(f"  Cert dates set:    {stats['certs_updated']}")
        print(f"  Cert dates kept:   {stats['certs_unchanged']} (already newer or same)")
        if stats["unmatched_headers"]:
            print("  [!] Unmatched cert columns (not in Certifications sheet):")
            for h in sorted(stats["unmatched_headers"]):
                print(f"       - {h}")

    if any_success:
        print(f"\nSaved: {WORKBOOK_PATH}")
    else:
        print("\nNo changes saved.")
    return 0 if any_success else 3


if __name__ == "__main__":
    sys.exit(main(sys.argv))

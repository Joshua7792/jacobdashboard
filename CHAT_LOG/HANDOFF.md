# Project Handoff

Last updated: April 28, 2026

Authoritative status snapshot for the next coding session. The verbatim
conversation transcript lives in `CHAT_LOG/*.raw.jsonl`; this file is the
"what does the app look like today and what's next" summary.

## Current Goal

Build a **personal visual dashboard** that reads the Excel certification
workbook and renders it as rich, interactive screens — KPIs, action lists,
contractor scorecards, worker drill-downs, cert coverage charts, and a
workers × certifications heatmap. Excel stays the source of truth: the
user edits there, hits **Refresh** in the app, and the dashboard reflects
the change.

Out of scope:

- Money, cost, payment, or purchasing workflows.
- Multi-user editing or cloud sync.
- Any database. The workbook IS the database.

## Repo Layout

```text
jacobdashboard/
├─ App Files/                       # The desktop dashboard app
│  ├─ launch_dashboard.py           # Entry point — opens the desktop window
│  ├─ build_desktop.py              # PyInstaller packager
│  ├─ JacobWorkforceDashboard.spec  # PyInstaller spec
│  ├─ README.md
│  ├─ backend/                      # FastAPI server (read-only Excel API)
│  │  ├─ requirements.txt
│  │  └─ app/
│  │     ├─ main.py                 # Mounts /api/excel + frontend
│  │     ├─ desktop.py              # Boots uvicorn + opens pywebview window
│  │     ├─ api/excel.py            # GET /api/excel/* + POST /refresh
│  │     └─ services/excel_reader.py # Workbook parser + cache
│  └─ frontend/                     # Vite + React + TypeScript
│     ├─ package.json
│     └─ src/
│        ├─ main.tsx, App.tsx, App.css, index.css, types.ts, api.ts
│        ├─ context/DashboardContext.tsx   # Shared workbook payload
│        ├─ lib/format.ts                  # Date / status formatting helpers
│        ├─ components/                    # ShellLayout, PageShell, KPIStrip,
│        │                                 # RefreshBar, StatusPill
│        └─ pages/                         # Six dashboard pages (see below)
├─ cert_tracker/                    # The workbook + the PDF importer toolkit
│  ├─ Contractor Certifications Tracker.xlsx       # Live workbook
│  ├─ Contractor Certifications Tracker Demo.xlsx  # Reproducible demo data
│  ├─ Import PDF.bat                # Drag-and-drop PDF entry point (Windows)
│  ├─ Evidence of training/         # Source PDFs (input examples)
│  └─ scripts/
│     ├─ import_pdf.py              # Main importer (Anejo 3 PDF → workbook)
│     ├─ build_cert_tracker.py      # Bootstrap a fresh workbook from scratch
│     ├─ populate_demo.py           # Fill the demo workbook with dummy data
│     └─ dedupe_workbook.py         # One-shot cleanup for legacy duplicates
├─ CHAT_LOG/
│  ├─ HANDOFF.md                    # ← you are here
│  ├─ README.md                     # Explains the chat log folder
│  └─ *.raw.jsonl                   # Verbatim chat transcripts
└─ .claude/settings.local.json      # Claude Code permissions for this repo
```

## How to Run

```bash
# from the project root
python "App Files/launch_dashboard.py"
```

The launcher builds the React frontend if `frontend/dist` is missing, then
opens a native desktop window pointing at a local FastAPI server on a free
port. To package as a single executable: `python "App Files/build_desktop.py"`.

## Frontend Architecture

Single-page React app with **six pages** under one `<DashboardProvider>` so
the workbook payload is fetched once and shared across all routes. The user
clicks **Refresh** on any page (top-of-page bar) to call
`POST /api/excel/refresh` and re-read.

| Route | Page | What it shows |
| --- | --- | --- |
| `/` | Overview | KPI strip + compliance donut + contractor leaderboard + top-5 urgent + 5 worst-covered certs |
| `/actions` | Action Center | Full filterable action list: search, contractor, status, days-bucket chips |
| `/contractors` | Contractor Scorecards | Grid of cards: compliance %, status mix bar, weakest cert, contact |
| `/workers` | Workforce Roster | Searchable table; click a worker to expand and see every cert they hold |
| `/certifications` | Cert Coverage | Stacked-bar chart (Recharts) of top 12 + full coverage table |
| `/heatmap` | Compliance Heatmap | Workers × certs grid, with contractor filter and sort modes |

Reusable components: `ShellLayout` (sidebar + content frame), `PageShell`
(per-page header + refresh + loading/error states), `KPIStrip`,
`RefreshBar`, `StatusPill` + `StatusStackedBar`.

## Backend Architecture

Single FastAPI app, no database. The workbook is the database.

```text
GET  /api/health                     liveness probe
GET  /api/excel/health               workbook path + last-modified info
GET  /api/excel/dashboard            full payload for the dashboard
GET  /api/excel/contractors          contractor rollups
GET  /api/excel/workers              all workers with their cert statuses
GET  /api/excel/workers/{name}       single worker (URL-encoded name)
GET  /api/excel/certifications       cert catalog
POST /api/excel/refresh              force reload from disk
GET  /                               serves the built React app (SPA fallback)
```

`services/excel_reader.py` is the parser:

- Caches the parsed workbook in memory.
- Auto-invalidates on file mtime change.
- Computes per-cell renewal status (green / yellow / red / blank).
- Aggregates per-worker, per-contractor, per-cert rollups.
- Builds an action list sorted by `abs(days_until_anniversary)` so recent
  transitions float to the top.

Color rules match the workbook's conditional formatting:

- GREEN: has a date and >60 days until 1-year anniversary
- YELLOW: has a date and 31–60 days until anniversary
- RED: has a date and ≤30 days until anniversary, or anniversary already passed
- BLANK: no date entered (intentionally not colored)

## PDF Importer (cert_tracker/scripts/import_pdf.py)

Drag-and-drop a Cordillera "Anejo 3" PDF onto `cert_tracker/Import PDF.bat`
on Windows. The importer:

- Identifies contractor name from the form header.
- Reads worker names + cert dates from page 1 (HSE certifications) using
  pdfplumber's `find_tables`. When a cell comes back empty, falls back to
  scanning the cell's bbox for date words (rescues date values that
  pdfplumber misaligned because of multi-line / wrapped text).
- Reads page 2 (additional training) using word-coordinate matching for
  rotated headers. Recognizes both `m/d/yyyy` and `Month YYYY` formats —
  even when the year wraps to the next visual line.
- Auto-registers any cert column that's not yet in the catalog (defaults
  to category "Additional Training", validity 0).
- Matches contractor names tolerantly ("GeoEnviroTech, Inc" ==
  "GeoEnviroTech, Inc.") and cert names tolerantly ("OSHA 8 Hr Refresher"
  == "OSHA 8Hr Refresher"). Reuses the workbook's spelling for both.
- Updates existing rows in place (newer date wins), never duplicates.
- Syncs Certifications ↔ Tracker ↔ Dashboard sheets so a rename in any one
  propagates via formula references.
- Re-applies the 1-year renewal color rules.

## Recent Work (April 28, 2026)

- Pivoted the entire stack away from the legacy SQLite workforce dashboard.
  Backend now serves only `/api/excel/*` + `/api/health` + the frontend.
  Frontend now has six dedicated pages (Overview, Actions, Contractors,
  Workers, Certifications, Heatmap), all sharing a single
  `DashboardContext`.
- Deleted from the backend: `database.py`, `models.py`, `schemas.py`,
  `seed.py`, `config.py`, all of `api/*.py` except `excel.py`, all of
  `services/*.py` except `excel_reader.py`, and the
  `data/workforce_dashboard.db` SQLite file.
- Trimmed `requirements.txt` (dropped sqlalchemy, python-multipart, pypdf;
  added openpyxl).
- Deleted from the frontend: legacy pages
  (Companies/Contractors/Workers/Certifications/Dashboard/Reports/TrainingHub),
  unused hooks, lib helpers, the `react.svg` asset, plus a few hundred
  lines of legacy types and API methods.
- PDF importer fixes:
  - Contractor matching is now punctuation-insensitive
    (`normalize_company`).
  - Cert-name matching is now whitespace-insensitive
    (`normalize_compact`); fixes the "OSHA 8 Hr Refresher" duplicate column
    bug.
  - Removed the over-aggressive "Manejo de Tijeras" fallback that was
    stealing dates from neighboring columns.
  - Added a bounded "orphan column" rescue that handles pdfplumber's
    multi-line header misalignment without false positives.
  - Page-2 extractor now recognizes month-year date pairs ("July 2005",
    "January\n2008") and OSHA HAZWOPER spelling variants
    ("OSHA40Hr HOZWOPER" → "OSHA 40Hr HAZWOPER").
- One-shot `dedupe_workbook.py` cleaned up legacy duplicate columns and
  rows already in the workbook.
- Added module-level comments to every kept file (frontend + backend) so a
  new collaborator can navigate the codebase without external docs.

## Known Future Work / Nice-to-Haves

1. **Worker risk score** — composite metric (count of red certs × cert
   weight) to surface highest-risk workers on the workers page.
2. **Trend over time** — would require periodic snapshots of the workbook
   (no historical data in the workbook today).
3. **Export to PDF** — for audit packets. Could render any page to PDF via
   the print-friendly stylesheet.
4. **Code-split the Recharts bundle** — production JS is ~580kB minified;
   lazy-loading the certifications page would drop initial load
   significantly.
5. **Inline-style ESLint warnings** — `style={{ width: ${pct}% }}` on the
   stacked bars and `style={{ '--cert-count': ... }}` on the heatmap are
   intentional (dynamic CSS variables). Could swap to data-attributes if
   the warnings become noisy.

## Tested Workflows

- Fresh import of `Cornerstone training evidence.pdf` correctly populates
  Manejo de Tijeras for José/Carlos/Felipe (3/4/2025).
- Fresh import of `Geoenvirotech certification evidence (1).pdf` correctly
  populates OSHA 40Hr HAZWOPER for all six workers (month-year dates).
- Re-importing the same PDF a second time updates existing rows in place
  (no duplicates).
- Frontend `npm run build` succeeds (≈3s) with no TypeScript errors.
- Backend `from app.main import app` succeeds and exposes only the
  expected routes.

# Project Handoff

Last updated: April 27, 2026

Use this file as the **current** project status snapshot for ChatGPT, Codex in
VS Code, or any future coding session. Longer conversation notes and decision
history belong in `PROJECT_HISTORY.md`. Per-session detail logs live in
`CHAT_LOG/`.

## Current Goal

Build a **personal visual dashboard** that reads the Excel certification
workbook and renders it as rich, interactive widgets — KPIs, action lists, and
a workers × certs heatmap. Excel stays the source of truth (you edit there,
the app reflects on Refresh).

The active project focus is:

- A living Excel tracker for contractor workers, required training,
  certification dates, and PDF imports.
- A read-only React/FastAPI dashboard that visualizes the workbook —
  "personal Power BI", but tightly tailored to HSE compliance tracking.

Out of scope for now:

- Money, cost, payment, or purchasing workflows.
- Multi-user editing or cloud sync.
- External reporting integrations (Power BI, etc.).

## Repo Areas

- `cert_tracker/` — Excel workflow + PDF import automation. Source of truth.
- `App Files/` — Local dashboard app (FastAPI + React).
- `.claude/settings.local.json` — Project-scoped Claude Code permissions
  (gitignored). Currently grants `Bash(*)` auto-approve.

---

## Certification Excel Tracker

### Workbooks

- `cert_tracker/Contractor Certifications Tracker.xlsx` — **live workbook**
  (real Cornerstone + GeoEnviroTech data). The everyday import flow
  (`Import PDF.bat`) reads/writes this file by default.
- `cert_tracker/Contractor Certifications Tracker Demo.xlsx` — dummy data for
  testing colors, formulas, and workflow without touching live records.
  Repopulated reproducibly via `populate_demo.py`.

### Automation files

- `cert_tracker/Import PDF.bat` — drag-and-drop launcher.
- `cert_tracker/scripts/import_pdf.py` — PDF reader + workbook updater +
  cross-sheet sync.
- `cert_tracker/scripts/build_cert_tracker.py` — workbook scaffolder
  (safety-guarded, refuses to overwrite an existing workbook unless `--force`).
- `cert_tracker/scripts/populate_demo.py` — dummy-data populator for the demo
  workbook (also safety-guarded).

### Workbook structure

7 sheets: `Instructions`, `Dashboard`, `Certifications`, `Contractors`,
`Job Titles`, `Workers`, `Tracker`.

- **Certifications is the source of truth for cert names, categories, and
  validity years.**
- **Tracker row 2 headers** are formulas like `=Certifications!A15` so renames
  in Certifications propagate to the Tracker automatically.
- **Dashboard compliance rows** (cols A & B) use the same formula pattern;
  count formulas use `INDEX/MATCH` against the Tracker so they survive column
  reordering.

### Conditional formatting on Tracker (1-year renewal rules)

| Days remaining until 1-year anniversary | Color |
|---|---|
| > 60 | 🟢 green |
| 31–60 | 🟡 yellow |
| ≤ 30 OR past anniversary | 🔴 red |
| (empty cell) | (no color, intentional) |

- Range: `C3:AZ200` so future cert columns inherit automatically.
- Implemented as 3 rules with `stopIfTrue=True` and `bgColor` (not `fgColor`)
  for the differential format fills. **`bgColor` was the bug fix when colors
  weren't rendering.**
- The `Tracker` no longer has a formal Excel Table object (it caused
  corruption when columns were added). It uses `AutoFilter` instead.

### What `import_pdf.py` does

1. Extracts contractor name from "Nombre de la compañía contratista: X".
2. Extracts primary contact from "Certificado por nombre/firma: X" (with
   signature-line cleanup that rebuilds names scattered across underscores).
3. Page 1 cert matrix parsed via `extract_tables`.
4. Page 2 "NOMBRE DEL ADIESTRAMIENTO" section parsed by **word-coordinate
   bucketing** (rotated headers break normal table extraction).
5. Three-tier cert name matching: exact alias → substring → token-overlap.
6. **Auto-registers unknown certs**: any PDF cert header not in the
   Certifications sheet is added there (Additional Training / 0-year validity
   default), then propagated into Tracker as a new column and Dashboard as a
   new row via the sync logic.
7. Date parsing handles `m/d-d/yyyy` and `m/d-d-yyyy` ranges by taking the
   last day in the range.
8. Idempotent: same PDF re-imported produces no duplicates; newer dates win;
   primary contact is only written when the cell is blank.

### What `--sync` does (run via `python scripts/import_pdf.py --sync`)

Reconciles all three sheets without importing a PDF:

1. Any **literal Tracker header** not in Certifications is added to
   Certifications, then the Tracker cell is rewritten as a formula reference.
2. Any **Certifications row** without a matching Tracker column gets one
   appended with the formula header.
3. **Dashboard** rows are backfilled for every Certifications row, with
   formulas for name, category, count (INDEX/MATCH), missing, %, and bar.
4. Tracker AutoFilter ref is extended.
5. CertificationsTable ref is extended if rows were added.
6. Tracker conditional formatting is wiped and re-applied (the 1-year
   renewal rules above).

`sync_workbook()` is also called automatically at the start of every PDF
import, so a single `Import PDF.bat` drop fully propagates new data through
all three sheets.

### Important safety rules

- The live workbook is **production data**. Never overwrite without an
  explicit user request.
- `build_cert_tracker.py` refuses to overwrite an existing workbook;
  `--force` is required for an intentional rebuild from seed data.
- `populate_demo.py` refuses to wipe the demo workbook unless `--force`
  is passed.
- `import_pdf.py` opens with the existing workbook lock; if Excel has the
  file open, the script reports "Permission denied — close Excel and retry."

### Everyday commands

```powershell
# Import a PDF (drag onto Import PDF.bat or run from CLI)
cd cert_tracker
python scripts\import_pdf.py "path\to\contractor-file.pdf"

# Sync sheets only, without importing a PDF
python scripts\import_pdf.py --sync

# Diagnostic mode (dumps extracted tables / coordinates)
$env:DEBUG_IMPORT = "1"
python scripts\import_pdf.py "path\to\contractor-file.pdf"
Remove-Item Env:\DEBUG_IMPORT

# Repopulate demo workbook with reproducible dummy data
python scripts\populate_demo.py --force

# Rebuild from seed (DANGEROUS - wipes the workbook)
python scripts\build_cert_tracker.py --force
```

---

## Dashboard App

App path: `App Files/`

### Current direction

The app is being rebuilt around an **Excel-as-source-of-truth** model.
SQLite layer is preserved but no longer the primary data source — new
endpoints under `/api/excel/*` read directly from the workbook.

### What's in place (Phase 0 — done)

Backend infrastructure to read the workbook and serve its data as JSON.

- `App Files/backend/app/services/excel_reader.py` — parses Contractors,
  Workers, Certifications, Tracker. Computes per-cell status (green / yellow
  / red / blank) using the same 1-year renewal rules as the Excel CF.
  Aggregates per-worker and per-contractor compliance, builds an
  urgency-sorted action list, cert demand ranking, heatmap payload, and KPIs.
- `App Files/backend/app/api/excel.py` — FastAPI router with these endpoints:
  - `GET  /api/excel/health`
  - `GET  /api/excel/dashboard`
  - `GET  /api/excel/contractors`
  - `GET  /api/excel/workers`
  - `GET  /api/excel/workers/{name}`
  - `GET  /api/excel/certifications`
  - `POST /api/excel/refresh`
- In-memory cache that auto-invalidates on file mtime change (so a save in
  Excel transparently refreshes the API). `/refresh` forces reload.
- Frontend `api.ts` + `types.ts` updated with corresponding TypeScript types
  and fetch methods.

Tested via FastAPI TestClient: all endpoints return 200 with correct data,
404 on missing workbook / missing worker, 423 on locked file. Cache hit and
mtime-invalidation confirmed.

### What's in progress (Phase 1)

Visual landing page driven by `/api/excel/dashboard`:

- KPI strip (4 cards: active workers, overall compliance %, urgent count,
  expiring-soon count)
- Action list (sortable, filterable by contractor and status)
- Compliance heatmap (workers × certs grid with colored cells)
- Refresh button + "Last loaded at HH:MM" indicator
- File created: `App Files/frontend/src/pages/ExcelDashboardPage.tsx`
- Not yet wired into routing or styled. CSS classes referenced but not yet
  added to `App.css`.

### Phases ahead

- **Phase 2** — Tier 2 drill-downs: per-contractor scorecards, worker profile
  drawer, cert demand chart.
- **Phase 3** — Filters, search, polish.
- **Phase 4** — (deferred) Trend snapshots from archived workbooks.

### Frontend files to inspect first

- `App Files/frontend/src/App.tsx`
- `App Files/frontend/src/components/ShellLayout.tsx`
- `App Files/frontend/src/pages/ExcelDashboardPage.tsx` (new — Phase 1 WIP)
- `App Files/frontend/src/pages/DashboardPage.tsx` (legacy SQLite version)
- `App Files/frontend/src/api.ts`
- `App Files/frontend/src/types.ts`
- `App Files/frontend/src/App.css`

### Backend files to inspect first

- `App Files/backend/app/main.py` (router mounting)
- `App Files/backend/app/api/excel.py` (new — read-only Excel endpoints)
- `App Files/backend/app/services/excel_reader.py` (new — parser + aggregator)
- `App Files/backend/app/database.py` (SQLite, legacy)

### Run commands

```powershell
# Local desktop launcher (builds frontend if needed)
cd "App Files"
python launch_dashboard.py

# Dev backend (hot reload)
cd "App Files\backend"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8124

# Dev frontend
cd "App Files\frontend"
npm run dev

# Build frontend for the desktop launcher
cd "App Files\frontend"
npm run build
```

---

## Decisions

- The Excel tracker workflow comes first; dashboard is a visual layer on top.
- The workbook is the **source of truth**. The dashboard reads it; it does
  not write back.
- Repeated PDF imports must be safe and never duplicate workers, contractors,
  or dates.
- Build / populate scripts must be safety-guarded against overwriting live
  data unless `--force` is passed.
- Cert names live in the Certifications sheet; Tracker headers and Dashboard
  rows reference Certifications via formulas so renames propagate.
- Tracker has no formal Excel Table — AutoFilter is used instead because
  Excel Tables corrupt when columns are added programmatically.
- 1-year renewal coloring uses `bgColor` (not `fgColor`) for the CF
  differential format fills.
- The dashboard app reads from Excel via `/api/excel/*`, with an in-memory
  cache that auto-invalidates on file mtime change.
- Bash auto-approve is enabled project-wide via
  `.claude/settings.local.json` so Claude Code doesn't pause for permission
  on routine commands.
- Record meaningful project decisions in `PROJECT_HISTORY.md`.

## Constraints

- Ask before destructive changes outside the agreed scope.
- Do not delete or overwrite workbook data unless explicitly requested.
- Do not manually revert unrelated user changes.
- Be careful with paths containing spaces, especially `App Files/`.
- Prefer editing source scripts/code over generated workbook edits.
- Keep the app usable as a local desktop app.
- Preserve the current visual direction unless the task is explicitly a
  redesign.
- When changing APIs, update frontend types and API client calls together.
- When changing workbook structure, update both builder/import scripts if
  needed.

## Next Good Tasks

1. **Finish Phase 1**: wire `ExcelDashboardPage` into routing, add CSS for
   KPI cards / action table / heatmap, replace the legacy Dashboard route,
   hide stale legacy pages from `ShellLayout` nav, run `npm run build` to
   confirm no errors.
2. **Phase 2**: per-contractor scorecard tiles, worker profile drawer, cert
   demand horizontal bar chart.
3. **Phase 3**: filter chips (contractor / status / category), global
   worker-name search, visual polish (animations, color-blind palette,
   light/dark mode).
4. Harden `extract_additional_training_page` so page-2 anchoring is dynamic
   instead of hard-coded Y bands.
5. Add an `Import Log` sheet recording PDF filename, timestamp, contractor,
   workers touched, and dates set.
6. Consider making `Import PDF.bat` produce a clear log file or
   user-friendly completion message.
7. Add a root-level README after the dashboard stabilizes.

## Suggested VS Code Codex Prompts

General continuation:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md. Continue from the current project
state. Start by inspecting the files listed for the area I ask about. Before
editing, summarize the plan and the files you expect to touch. Preserve
existing user data, do not revert unrelated changes, and prefer
source-code/script changes over generated workbook edits.
```

Excel tracker work:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md, then inspect
@cert_tracker/scripts/import_pdf.py and
@cert_tracker/scripts/build_cert_tracker.py. Update the scripts first and
only regenerate or edit the workbook if explicitly requested.
```

Dashboard work:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md, then inspect
@"App Files/frontend/src/pages/ExcelDashboardPage.tsx",
@"App Files/frontend/src/api.ts", and
@"App Files/backend/app/api/excel.py". Continue Phase 1 of the dashboard
implementation.
```

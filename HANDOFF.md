# Project Handoff

Last updated: April 23, 2026

Use this file as the current project status snapshot for ChatGPT, Codex in VS Code, or any future coding session. Longer conversation notes and decision history belong in `PROJECT_HISTORY.md`.

## Current Goal

Finish the contractor and worker certification workflow before expanding the dashboard app further.

The active project focus is:

- A living Excel tracker for contractor workers, required training, certification dates, and PDF imports.
- A local dashboard app for contractor/workforce readiness, training evidence, certifications, and simple reporting.

Out of scope for now:

- Money, cost, payment, or purchasing workflows.
- External reporting models unrelated to the contractor/workforce tracker.

## Repo Areas

- `cert_tracker/`: the active Excel workflow and PDF import automation.
- `App Files/`: the local dashboard app.

## Certification Excel Tracker

Tracker workbook:

- `cert_tracker/Contractor Certifications Tracker.xlsx`

Automation files:

- `cert_tracker/scripts/import_pdf.py`
- `cert_tracker/scripts/build_cert_tracker.py`
- `cert_tracker/Import PDF.bat`

Current workbook role:

- The `.xlsx` is the living source of truth for the Excel side.
- It should be treated like a database, not a disposable report.
- Ongoing updates should happen through `Import PDF.bat` or `import_pdf.py`.

What it does today:

- Tracks contractors and workers.
- Uses a Tracker sheet keyed by contractor plus worker.
- Stores required training and certification completion dates.
- Uses formulas and formatting to show complete, missing, expired, and expiring-soon items.
- Includes a Job Titles sheet with a dynamic `JobTitleOptions` named range so manually entered job titles can appear in dropdowns later.
- Imports the Anejo 3 contractor training PDF into the workbook.
- Matches contractors and workers by normalized name so repeated imports do not create duplicates.
- Uses newer-wins date logic so an older PDF date does not overwrite a newer workbook date.
- Writes primary contact only when the contractor contact cell is blank.
- Adds missing certification rows/columns when the PDF includes a recognized training item that is not already in the workbook.

Important safety rule:

- `build_cert_tracker.py` creates a new workbook from scratch. It is safety-guarded and refuses to overwrite the live workbook unless `--force` is passed.

Everyday import command:

```powershell
cd cert_tracker
python scripts\import_pdf.py "path\to\contractor-file.pdf"
```

Diagnostic import command:

```powershell
cd cert_tracker
$env:DEBUG_IMPORT = "1"
python scripts\import_pdf.py "path\to\contractor-file.pdf"
Remove-Item Env:\DEBUG_IMPORT
```

Dangerous rebuild command:

```powershell
cd cert_tracker
python scripts\build_cert_tracker.py --force
```

Only use the rebuild command when intentionally resetting the workbook from seed data.

## Dashboard App

App path:

- `App Files/`

Current app role:

- Local app for viewing and managing contractors, workers, training records, evidence, and reports.
- Keep app development secondary until the Excel workflow behaves exactly as expected.

What it does today:

- Shows a dashboard for workforce readiness, contractor compliance, imported evidence, and recent workers.
- Tracks companies/projects, contractors, workers, training records, and uploaded evidence.
- Provides a Training Hub for contractor matrix PDF preview/import and manual training date updates.
- Provides an Evidence page for completed training/certification records and CSV exports.
- Provides a Report Studio for simple chart previews grouped by workers or trainings.
- Seeds the Cordillera project, default contractors, and the training catalog on startup.

Frontend files to inspect first:

- `App Files/frontend/src/App.tsx`
- `App Files/frontend/src/components/ShellLayout.tsx`
- `App Files/frontend/src/pages/DashboardPage.tsx`
- `App Files/frontend/src/pages/TrainingHubPage.tsx`
- `App Files/frontend/src/pages/ReportsPage.tsx`
- `App Files/frontend/src/api.ts`
- `App Files/frontend/src/types.ts`
- `App Files/frontend/src/App.css`

Backend files to inspect first:

- `App Files/backend/app/main.py`
- `App Files/backend/app/models.py`
- `App Files/backend/app/schemas.py`
- `App Files/backend/app/database.py`
- `App Files/backend/app/config.py`
- `App Files/backend/app/seed.py`
- `App Files/backend/app/api/training.py`
- `App Files/backend/app/api/workers.py`
- `App Files/backend/app/api/contractors.py`
- `App Files/backend/app/api/dashboard.py`
- `App Files/backend/app/api/reports.py`
- `App Files/backend/app/services/contractor_matrix.py`
- `App Files/backend/app/services/analytics.py`

Run local desktop app:

```powershell
cd "App Files"
python launch_dashboard.py
```

Run development backend:

```powershell
cd "App Files\backend"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8124
```

Run development frontend:

```powershell
cd "App Files\frontend"
npm run dev
```

Build frontend:

```powershell
cd "App Files\frontend"
npm run build
```

## Decisions

- The Excel tracker workflow comes first.
- The workbook is live data and must not be overwritten accidentally.
- Repeated PDF imports must be safe and should not duplicate workers, contractors, or dates.
- The build script is only for intentional rebuilds.
- Keep the dashboard app local-first with React, FastAPI, and SQLite.
- Preserve live SQLite data, uploads, and workbook data unless the user explicitly requests removal.
- Do not reintroduce out-of-scope money/cost/payment workflows without an explicit future decision.
- Record meaningful project decisions in `PROJECT_HISTORY.md`.

## Constraints

- Ask before major or destructive changes.
- Do not delete or overwrite workbook data unless explicitly requested.
- Do not manually revert unrelated user changes.
- Be careful with paths containing spaces, especially `App Files/`.
- Prefer editing source scripts/code over generated workbook edits.
- Keep the app usable as a local desktop app.
- Preserve the current visual direction unless the task is explicitly a redesign.
- When changing APIs, update frontend types and API client calls together.
- When changing workbook structure, update both builder/import scripts if needed.

## Next Good Tasks

1. Finish verifying the Excel PDF import flow against the user's expectations.
2. Re-run representative contractor PDFs and inspect the workbook output for duplicates, missing dates, and wrong matches.
3. Harden `extract_additional_training_page` in `cert_tracker/scripts/import_pdf.py` so page-2 extraction anchors dynamically instead of relying only on fixed Y coordinate bands.
4. Add an `Import Log` sheet to the workbook to record PDF filename, timestamp, contractor, workers touched, and dates set.
5. Consider making `Import PDF.bat` produce a clear log file or user-friendly completion message.
6. Clean up encoding display issues where Spanish labels appear garbled in docs or terminal output.
7. Add a root-level README after the Excel workflow stabilizes.

## Suggested VS Code Codex Prompts

General continuation:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md. Continue from the current project state. Start by inspecting the files listed for the area I ask about. Before editing, summarize the plan and the files you expect to touch. Preserve existing user data, do not revert unrelated changes, and prefer source-code/script changes over generated workbook edits.
```

Excel tracker work:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md, then inspect @cert_tracker/scripts/import_pdf.py and @cert_tracker/scripts/build_cert_tracker.py. Update the scripts first and only regenerate or edit the workbook if explicitly requested.
```

Dashboard work:

```text
Read @HANDOFF.md and @PROJECT_HISTORY.md, then inspect @"App Files/frontend/src/App.tsx", @"App Files/frontend/src/api.ts", and @"App Files/backend/app/main.py". Continue the dashboard implementation for the requested feature.
```

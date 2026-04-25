# Project History

This file records important conversation context, decisions, and work-session notes so future ChatGPT or Codex sessions can continue without relying on one chat thread.

## 2026-04-23

### Shared Memory Pattern

Decision:

- Keep `HANDOFF.md` as the current status snapshot.
- Keep `PROJECT_HISTORY.md` as the longer history and decision log.
- Update these files after meaningful work sessions so context survives if chat history is lost.

### Active Project Direction

Decision:

- Focus first on the contractor/worker Excel certification workflow.
- Make sure PDF imports, workbook updates, worker matching, contractor matching, primary contact handling, and date logic behave the way the user expects.
- Keep dashboard development secondary until the Excel workflow is solid.

### Excel Tracker Safety

Context:

- `cert_tracker/Contractor Certifications Tracker.xlsx` is live data.
- `import_pdf.py` is the safe ongoing updater.
- `build_cert_tracker.py` creates a new workbook from scratch and can wipe imported workbook data if used carelessly.

Decision:

- Add a safety guard to `build_cert_tracker.py`.
- The script now refuses to overwrite the workbook when it already exists.
- Passing `--force` is required for an intentional rebuild.

Development lesson captured:

- Use a safe-by-default pattern for destructive scripts.
- Check preconditions before destructive work.
- Require an explicit flag for dangerous actions.
- Return clear exit codes.
- Print a warning that explains both the risk and the correct everyday workflow.

### PDF Import Model

Confirmed behavior:

- The same contractor PDF may be submitted repeatedly over time as a living report.
- Re-importing the same PDF should not duplicate contractors or workers.
- If a worker already exists, the importer updates existing rows instead of adding duplicates.
- Existing certificate dates are only updated when the incoming date is newer.
- Primary contact is only written if the contractor contact cell is blank.
- Unknown certificate headers should appear in the terminal output so aliases can be added later.

### Job Titles

Confirmed behavior:

- Job titles are typed manually into the Workers sheet.
- Existing titles become reusable later through the dynamic `JobTitleOptions` named range.
- No separate change was needed for job titles.

### Scope Cleanup

Decision:

- Remove the previous money/cost/payment direction from the current project scope.
- The project should focus on contractors, workers, certification tracking, PDF imports, evidence, and readiness reporting.
- Do not bring the removed scope back unless the user explicitly asks for it in the future.

Completed cleanup:

- Removed stale status references from `HANDOFF.md`.
- Created this separate project history file so `HANDOFF.md` can stay focused on current status.
- Confirmed app source no longer references the removed workflow.
- Removed the old company/contractor numeric database fields from `workforce_dashboard.db`.
- Created a temporary SQLite backup before the schema edit, then deleted the backup after verification because the user requested the old scope be fully removed.
- Verified backend Python compilation and frontend production build.

### Excel Demo Workbook

Request:

- Before using the tracker for real work, create a safe way to test the Excel workflow with dummy contractors and workers.

Completed:

- Created `cert_tracker/Contractor Certifications Tracker - Demo.xlsx` with 3 dummy contractors and 9 dummy workers.
- Kept `cert_tracker/Contractor Certifications Tracker.xlsx` as the live workbook name used by `Import PDF.bat`.
- Refreshed the live workbook Tracker conditional-formatting rules without changing contractor, worker, or cert-date data.
- Added the missing `Job Titles` helper sheet to the live and demo workbooks.
- Updated `build_cert_tracker.py` and `import_pdf.py` so future Tracker conditional-formatting rules are mutually exclusive:
  - Red means missing.
  - Orange means expired.
  - Yellow means expiring within 60 days.
  - Green means current/valid or no-expiration training with a date.

Notes:

- The demo workbook intentionally includes current, expiring-soon, expired, and blank/missing cells so the user can review the visual behavior before entering more real data.
- Adding an extra `Demo Guide` sheet caused workbook saves to hang in testing, so the demo guidance was added to the existing Instructions sheet instead.

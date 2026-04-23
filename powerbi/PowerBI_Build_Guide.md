# Power BI Build Guide

Source workbook: `Project_Finance_Tracker_1.xlsx`

## Source Tables

Load these Excel tables into Power BI Desktop:

- `tblContractors`
- `tblBudget`
- `tblInvoices`
- `tblChangeLog`

Use the source tabs as the system of record:

- `Contractors`
- `Budget`
- `Invoices`
- `Change Log`

Use the `Dashboard` and `Budget Charts` tabs as presentation layers only.

## Relationships

Create these model relationships:

- `Contractors[Contractor ID]` 1-to-many `Budget[Contractor ID]`
- `Contractors[Contractor ID]` 1-to-many `Invoices[Contractor ID]`

Recommended model settings:

- Mark `Invoices[Invoice Date]` as the primary date field for time visuals.
- Turn off Auto date/time if you want a cleaner audited model.
- Create a proper Date table if the report will be expanded beyond the starter build.

## Measures

Create the measures from `Project_Finance_Tracker_Measures.dax`.

The most important measures for the first report page are:

- `Approved Budget`
- `Actual Spend`
- `Remaining Budget`
- `Budget Used %`
- `Pending Exposure`
- `Over Cap Amount`
- `Change Log Entries`
- `Budget Risk Band`

## Recommended Page Layout

### Page 1: Executive Overview

Top row cards:

- Approved Budget
- Actual Spend
- Remaining Budget
- Budget Used %
- Pending Exposure
- Change Log Entries

Main visuals:

- Stacked bar or 100% stacked bar for `Actual Spend`, `Remaining Budget`, and `Over Cap Amount`
- Clustered bar chart for `Actual Spend` by `Contractor Name`
- Line or column chart for monthly `Actual Spend` by `Invoice Date`
- Donut or stacked bar for invoice amount by `Status`

Audit table:

- `Contractor Name`
- `Approved Budget`
- `Actual Spend`
- `Remaining Budget`
- `Budget Used %`
- `Budget Risk Band`

### Page 2: Contractor Detail

Recommended visuals:

- Slicer on `Contractor Name`
- Card for contractor approved budget
- Card for contractor actual spend
- Card for contractor remaining budget
- Bar chart by `Phase`
- Table of invoices with:
  - `Invoice ID`
  - `Invoice Date`
  - `Phase`
  - `Invoice Amount`
  - `Status`
  - `PO / Reference #`
  - `Entered By`

### Page 3: Audit Trail

Recommended visuals:

- Card for `Change Log Entries`
- Table from `Change Log`
- Matrix or bar chart of changes by `Entity`
- Matrix or bar chart of changes by `Changed By`

## Visual Formatting Guidance

Use these thresholds consistently:

- Safe: `0%` to `59%`
- Caution: `60%` to `84%`
- Critical: `85%` to `100%+`

Suggested color mapping:

- Safe: green
- Caution: amber
- Critical: red
- Paid / completed amounts: blue or green
- Pending exposure: amber

## Power BI Desktop Build Order

1. Open Power BI Desktop.
2. Get Data > Excel workbook > `Project_Finance_Tracker_1.xlsx`.
3. Load `tblContractors`, `tblBudget`, `tblInvoices`, and `tblChangeLog`.
4. Create the relationships listed above.
5. Add the measures from `Project_Finance_Tracker_Measures.dax`.
6. Build the Executive Overview page first.
7. Save the file as a `.pbix`.
8. If you want source-control-friendly artifacts, use `File > Save As > Power BI Project (.pbip)`.

## Live Refresh Notes

This workbook is prepared so Excel remains the entry point and Power BI remains the reporting layer.

For the cleanest refresh setup:

- Keep the workbook in one stable path.
- Avoid renaming the tables.
- If you move the workbook later, update the Power BI data source path.
- If the workbook will live in SharePoint or OneDrive, repoint the Power BI source to that synced location or online connector as part of the final deployment.

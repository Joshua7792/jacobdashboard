param(
  [string]$WorkbookPath = "C:\Users\jsant\jacobdashboard\Project_Finance_Tracker_1.xlsx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-OrCreateWorksheet {
  param(
    [Parameter(Mandatory = $true)]$Workbook,
    [Parameter(Mandatory = $true)][string]$Name,
    $AfterSheet = $null
  )

  foreach ($sheet in $Workbook.Worksheets) {
    if ($sheet.Name -eq $Name) {
      return $sheet
    }
  }

  if ($null -ne $AfterSheet) {
    $sheet = $Workbook.Worksheets.Add([Type]::Missing, $AfterSheet)
  }
  else {
    $sheet = $Workbook.Worksheets.Add()
  }

  $sheet.Name = $Name
  return $sheet
}

function Remove-AllChartObjects {
  param([Parameter(Mandatory = $true)]$Worksheet)

  while ($Worksheet.ChartObjects().Count -gt 0) {
    $Worksheet.ChartObjects().Item(1).Delete()
  }
}

function Remove-NonChartShapes {
  param([Parameter(Mandatory = $true)]$Worksheet)

  for ($index = $Worksheet.Shapes.Count; $index -ge 1; $index--) {
    $shape = $Worksheet.Shapes.Item($index)
    if ($shape.Type -ne 3) {
      $shape.Delete()
    }
  }
}

function Set-Card {
  param(
    [Parameter(Mandatory = $true)]$Worksheet,
    [Parameter(Mandatory = $true)][string]$LabelRange,
    [Parameter(Mandatory = $true)][string]$ValueRange,
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Formula,
    [Parameter(Mandatory = $true)][int]$FillColor,
    [Parameter(Mandatory = $true)][int]$FontColor,
    [string]$NumberFormat = '$#,##0'
  )

  $labelCell = $Worksheet.Range($LabelRange)
  $valueCell = $Worksheet.Range($ValueRange)

  $labelCell.Merge()
  $valueCell.Merge()

  $labelCell.Value2 = $Label
  $valueCell.Formula = $Formula

  foreach ($target in @($labelCell, $valueCell)) {
    $target.Interior.Color = $FillColor
    $target.Font.Color = $FontColor
    $target.Borders.LineStyle = 1
    $target.Borders.Color = 15132390
  }

  $labelCell.Font.Bold = $true
  $labelCell.Font.Size = 10
  $labelCell.HorizontalAlignment = -4108
  $labelCell.VerticalAlignment = -4108

  $valueCell.Font.Bold = $true
  $valueCell.Font.Size = 18
  $valueCell.HorizontalAlignment = -4108
  $valueCell.VerticalAlignment = -4108
  $valueCell.NumberFormat = $NumberFormat
}

function Set-DataLabelColor {
  param(
    [Parameter(Mandatory = $true)]$Series,
    [Parameter(Mandatory = $true)][int]$Color
  )

  try {
    $Series.ApplyDataLabels()
    $Series.DataLabels().Font.Color = $Color
    $Series.DataLabels().Font.Size = 9
  }
  catch {
  }
}

$resolvedPath = (Resolve-Path $WorkbookPath).Path
$root = Split-Path -Parent $resolvedPath
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $root ("Project_Finance_Tracker_1.backup_{0}.xlsx" -f $timestamp)

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

$workbook = $null

try {
  $workbook = $excel.Workbooks.Open($resolvedPath)
  $workbook.SaveCopyAs($backupPath)

  $invoicesSheet = $workbook.Worksheets.Item("Invoices")
  $changeLogSheet = Get-OrCreateWorksheet -Workbook $workbook -Name "Change Log" -AfterSheet $invoicesSheet
  $dashboardSheet = $workbook.Worksheets.Item("Budget Charts")

  $changeLogSheet.Cells.Clear()
  Remove-AllChartObjects -Worksheet $changeLogSheet
  Remove-NonChartShapes -Worksheet $changeLogSheet

  $changeLogSheet.Range("B2:K2").Merge()
  $changeLogSheet.Range("B2").Value2 = "Change Log"
  $changeLogSheet.Range("B2").Font.Bold = $true
  $changeLogSheet.Range("B2").Font.Size = 18
  $changeLogSheet.Range("B3:K3").Merge()
  $changeLogSheet.Range("B3").Value2 = "Use this tab as the audit trail for budget revisions, invoice corrections, contractor changes, and approval updates."
  $changeLogSheet.Range("B3").Font.Color = 7039851

  $changeLogHeaders = @(
    "Change ID",
    "Change Date",
    "Entity",
    "Record ID",
    "Field Changed",
    "Old Value",
    "New Value",
    "Changed By",
    "Reason",
    "Approved By"
  )

  for ($i = 0; $i -lt $changeLogHeaders.Count; $i++) {
    $changeLogSheet.Cells.Item(5, 2 + $i).Value2 = $changeLogHeaders[$i]
  }

  $changeLogRange = $changeLogSheet.Range("B5:K6")

  try {
    $changeLogSheet.ListObjects.Item("tblChangeLog").Delete()
  }
  catch {
  }

  $changeLogTable = $changeLogSheet.ListObjects.Add(1, $changeLogRange, $null, 1)
  $changeLogTable.Name = "tblChangeLog"
  $changeLogTable.TableStyle = "TableStyleMedium2"
  $changeLogSheet.Range("C6").NumberFormat = "m/d/yyyy"
  $changeLogSheet.Range("B:K").ColumnWidth = 18
  $changeLogSheet.Range("B:K").EntireColumn.AutoFit() | Out-Null
  $changeLogSheet.Range("B6:K200").HorizontalAlignment = -4131
  $changeLogSheet.Rows("5:6").RowHeight = 24

  $dashboardSheet.Cells.Clear()
  Remove-AllChartObjects -Worksheet $dashboardSheet
  Remove-NonChartShapes -Worksheet $dashboardSheet

  $dashboardSheet.Activate() | Out-Null
  $excel.ActiveWindow.DisplayGridlines = $false
  $dashboardSheet.Tab.Color = 12611584

  foreach ($col in 2..21) {
    $dashboardSheet.Columns.Item($col).ColumnWidth = 12
  }

  $dashboardSheet.Rows("2:50").RowHeight = 24

  $dashboardSheet.Range("B2:S2").Merge()
  $dashboardSheet.Range("B2").Value2 = "Executive Budget Dashboard"
  $dashboardSheet.Range("B2").Font.Bold = $true
  $dashboardSheet.Range("B2").Font.Size = 22
  $dashboardSheet.Range("B2").Font.Color = 2039573

  $dashboardSheet.Range("B3:S3").Merge()
  $dashboardSheet.Range("B3").Value2 = "Live budget utilization, contractor variance, invoice exposure, and audit signals for Excel and Power BI reporting."
  $dashboardSheet.Range("B3").Font.Color = 7039851

  Set-Card -Worksheet $dashboardSheet -LabelRange "B5:D5" -ValueRange "B6:D7" -Label "Total Approved Budget" -Formula "=SUM(tblBudget[Approved Amount])" -FillColor 16777215 -FontColor 2039573
  Set-Card -Worksheet $dashboardSheet -LabelRange "E5:G5" -ValueRange "E6:G7" -Label "Actual Spend (Paid + Approved)" -Formula '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved")' -FillColor 16777215 -FontColor 2039573
  Set-Card -Worksheet $dashboardSheet -LabelRange "H5:J5" -ValueRange "H6:J7" -Label "Remaining Budget" -Formula "=SUM(tblBudget[Approved Amount])-(SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],""Paid"")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],""Approved""))" -FillColor 16777215 -FontColor 2039573
  Set-Card -Worksheet $dashboardSheet -LabelRange "K5:M5" -ValueRange "K6:M7" -Label "Utilization %" -Formula '=IFERROR((SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved"))/SUM(tblBudget[Approved Amount]),0)' -FillColor 15773696 -FontColor 2039573 -NumberFormat "0.0%"
  Set-Card -Worksheet $dashboardSheet -LabelRange "N5:P5" -ValueRange "N6:P7" -Label "Pending Invoice Exposure" -Formula '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Pending")' -FillColor 16119285 -FontColor 9241600
  Set-Card -Worksheet $dashboardSheet -LabelRange "Q5:S5" -ValueRange "Q6:S7" -Label "Change Log Entries" -Formula '=COUNTA(tblChangeLog[Change ID])' -FillColor 15921906 -FontColor 2039573 -NumberFormat "0"

  $dashboardSheet.Range("X2").Value2 = "Chart Helpers"
  $dashboardSheet.Range("X4").Value2 = "Category"
  $dashboardSheet.Range("Y4").Value2 = "Amount"
  $dashboardSheet.Range("X5").Value2 = "Allocated"
  $dashboardSheet.Range("Y5").Formula = '=MIN(SUM(tblBudget[Approved Amount]),SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved"))'
  $dashboardSheet.Range("X6").Value2 = "Remaining"
  $dashboardSheet.Range("Y6").Formula = '=MAX(SUM(tblBudget[Approved Amount])-(SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved")),0)'
  $dashboardSheet.Range("X7").Value2 = "Over Cap"
  $dashboardSheet.Range("Y7").Formula = '=MAX((SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved"))-SUM(tblBudget[Approved Amount]),0)'

  $dashboardSheet.Range("X10").Value2 = "Contractor"
  $dashboardSheet.Range("Y10").Value2 = "Approved Budget"
  $dashboardSheet.Range("Z10").Value2 = "Actual Spend"
  $dashboardSheet.Range("AA10").Value2 = "Remaining"
  $dashboardSheet.Range("AB10").Value2 = "% Used"

  for ($row = 11; $row -le 30; $row++) {
    $prev = $row - 10
    $dashboardSheet.Range("X$row").Formula = "=IFERROR(INDEX(tblContractors[Contractor Name],$prev),"""")"
    $dashboardSheet.Range("Y$row").Formula = "=IF(`$X$row="""","""",SUMIFS(tblBudget[Approved Amount],tblBudget[Contractor Name],`$X$row))"
    $dashboardSheet.Range("Z$row").Formula = "=IF(`$X$row="""","""",SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Contractor Name],`$X$row,tblInvoices[Status],""Paid"")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Contractor Name],`$X$row,tblInvoices[Status],""Approved""))"
    $dashboardSheet.Range("AA$row").Formula = "=IF(`$X$row="""","""",`$Y$row-`$Z$row)"
    $dashboardSheet.Range("AB$row").Formula = "=IFERROR(`$Z$row/`$Y$row,0)"
  }

  $dashboardSheet.Range("X35").Value2 = "Month"
  $dashboardSheet.Range("Y35").Value2 = "Spend"
  $dashboardSheet.Range("X36").Formula = '=DATE(YEAR(MIN(tblInvoices[Invoice Date])),MONTH(MIN(tblInvoices[Invoice Date])),1)'
  for ($row = 37; $row -le 47; $row++) {
    $prior = $row - 1
    $dashboardSheet.Range("X$row").Formula = "=EDATE(X$prior,1)"
  }
  for ($row = 36; $row -le 47; $row++) {
    $dashboardSheet.Range("Y$row").Formula = "=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Invoice Date],"">=""&X$row,tblInvoices[Invoice Date],""<""&EDATE(X$row,1),tblInvoices[Status],""Paid"")+SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Invoice Date],"">=""&X$row,tblInvoices[Invoice Date],""<""&EDATE(X$row,1),tblInvoices[Status],""Approved"")"
    $dashboardSheet.Range("X$row").NumberFormat = "mmm yyyy"
  }

  $dashboardSheet.Range("X50").Value2 = "Status"
  $dashboardSheet.Range("Y50").Value2 = "Amount"
  $dashboardSheet.Range("X51").Value2 = "Pending"
  $dashboardSheet.Range("X52").Value2 = "Approved"
  $dashboardSheet.Range("X53").Value2 = "Paid"
  $dashboardSheet.Range("X54").Value2 = "Voided"
  $dashboardSheet.Range("Y51").Formula = '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Pending")'
  $dashboardSheet.Range("Y52").Formula = '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Approved")'
  $dashboardSheet.Range("Y53").Formula = '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Paid")'
  $dashboardSheet.Range("Y54").Formula = '=SUMIFS(tblInvoices[Invoice Amount],tblInvoices[Status],"Voided")'

  $dashboardSheet.Range("B41:S43").Merge()
  $dashboardSheet.Range("B41").Value2 = "Audit notes: the dashboard recalculates from the Contractors, Budget, Invoices, and Change Log tables. Use the source tabs for entries; use this sheet and Power BI for executive reporting."
  $dashboardSheet.Range("B41").WrapText = $true
  $dashboardSheet.Range("B41").Interior.Color = 15987699
  $dashboardSheet.Range("B41").Font.Color = 4473924
  $dashboardSheet.Range("B41").Font.Size = 11
  $dashboardSheet.Range("B41").HorizontalAlignment = -4131
  $dashboardSheet.Range("B41").VerticalAlignment = -4108

  $workbook.Application.CalculateFull()

  $dashboardSheet.Range("B10:F10").Merge()
  $dashboardSheet.Range("B10").Value2 = "Budget Utilization"
  $dashboardSheet.Range("B10").Font.Bold = $true
  $dashboardSheet.Range("B10").Font.Size = 14
  $dashboardSheet.Range("B11:F15").Interior.Color = 16579836

  $dashboardSheet.Range("B12").Value2 = "Allocated"
  $dashboardSheet.Range("B13").Value2 = "Remaining"
  $dashboardSheet.Range("B14").Value2 = "Over Cap"
  $dashboardSheet.Range("C12").Formula = "=Y5"
  $dashboardSheet.Range("C13").Formula = "=Y6"
  $dashboardSheet.Range("C14").Formula = "=Y7"
  $dashboardSheet.Range("D12").Formula = '=REPT("#",ROUND(IFERROR(C12/MAX($C$12:$C$14),0)*28,0))'
  $dashboardSheet.Range("D13").Formula = '=REPT("#",ROUND(IFERROR(C13/MAX($C$12:$C$14),0)*28,0))'
  $dashboardSheet.Range("D14").Formula = '=REPT("#",ROUND(IFERROR(C14/MAX($C$12:$C$14),0)*28,0))'
  $dashboardSheet.Range("C12:C14").NumberFormat = '$#,##0'
  $dashboardSheet.Range("D12:D14").Font.Name = "Consolas"
  $dashboardSheet.Range("D12").Font.Color = 2457855
  $dashboardSheet.Range("D13").Font.Color = 12573694
  $dashboardSheet.Range("D14").Font.Color = 4464876

  $dashboardSheet.Range("H10:M10").Merge()
  $dashboardSheet.Range("H10").Value2 = "Contractor Spend Snapshot"
  $dashboardSheet.Range("H10").Font.Bold = $true
  $dashboardSheet.Range("H10").Font.Size = 14
  $dashboardSheet.Range("H11:M17").Interior.Color = 16579836
  $dashboardSheet.Range("H11").Value2 = "Contractor"
  $dashboardSheet.Range("I11").Value2 = "Actual Spend"
  $dashboardSheet.Range("J11").Value2 = "Approved"
  $dashboardSheet.Range("K11").Value2 = "% Used"
  $dashboardSheet.Range("L11").Value2 = "Visual"
  for ($row = 12; $row -le 16; $row++) {
    $helperRow = $row - 1
    $dashboardSheet.Range("H$row").Formula = "=X$helperRow"
    $dashboardSheet.Range("I$row").Formula = "=Z$helperRow"
    $dashboardSheet.Range("J$row").Formula = "=Y$helperRow"
    $dashboardSheet.Range("K$row").Formula = "=AB$helperRow"
    $dashboardSheet.Range("L$row").Formula = '=REPT("#",ROUND(IFERROR(I' + $row + '/MAX($I$12:$I$16),0)*20,0))'
  }
  $dashboardSheet.Range("I12:J16").NumberFormat = '$#,##0'
  $dashboardSheet.Range("K12:K16").NumberFormat = '0.0%'
  $dashboardSheet.Range("L12:L16").Font.Name = "Consolas"
  $dashboardSheet.Range("L12:L16").Font.Color = 2457855

  $dashboardSheet.Range("B18:F18").Merge()
  $dashboardSheet.Range("B18").Value2 = "Monthly Spend Trend"
  $dashboardSheet.Range("B18").Font.Bold = $true
  $dashboardSheet.Range("B18").Font.Size = 14
  $dashboardSheet.Range("B19:F31").Interior.Color = 16579836
  $dashboardSheet.Range("B19").Value2 = "Month"
  $dashboardSheet.Range("C19").Value2 = "Spend"
  $dashboardSheet.Range("D19").Value2 = "Visual"
  for ($row = 20; $row -le 31; $row++) {
    $helperRow = $row + 16
    $dashboardSheet.Range("B$row").Formula = "=X$helperRow"
    $dashboardSheet.Range("C$row").Formula = "=Y$helperRow"
    $dashboardSheet.Range("D$row").Formula = '=REPT("#",ROUND(IFERROR(C' + $row + '/MAX($C$20:$C$31),0)*20,0))'
  }
  $dashboardSheet.Range("B20:B31").NumberFormat = "mmm yyyy"
  $dashboardSheet.Range("C20:C31").NumberFormat = '$#,##0'
  $dashboardSheet.Range("D20:D31").Font.Name = "Consolas"
  $dashboardSheet.Range("D20:D31").Font.Color = 15373582

  $dashboardSheet.Range("H18:M18").Merge()
  $dashboardSheet.Range("H18").Value2 = "Invoice Status Exposure"
  $dashboardSheet.Range("H18").Font.Bold = $true
  $dashboardSheet.Range("H18").Font.Size = 14
  $dashboardSheet.Range("H19:M24").Interior.Color = 16579836
  $dashboardSheet.Range("H19").Value2 = "Status"
  $dashboardSheet.Range("I19").Value2 = "Amount"
  $dashboardSheet.Range("J19").Value2 = "Visual"
  for ($row = 20; $row -le 23; $row++) {
    $helperRow = $row + 31
    $dashboardSheet.Range("H$row").Formula = "=X$helperRow"
    $dashboardSheet.Range("I$row").Formula = "=Y$helperRow"
    $dashboardSheet.Range("J$row").Formula = '=REPT("#",ROUND(IFERROR(I' + $row + '/MAX($I$20:$I$23),0)*20,0))'
  }
  $dashboardSheet.Range("I20:I23").NumberFormat = '$#,##0'
  $dashboardSheet.Range("J20:J23").Font.Name = "Consolas"
  $dashboardSheet.Range("J20").Font.Color = 7618731
  $dashboardSheet.Range("J21").Font.Color = 16024123
  $dashboardSheet.Range("J22").Font.Color = 6206754
  $dashboardSheet.Range("J23").Font.Color = 4473924

  $dashboardSheet.Range("X:AB").EntireColumn.Hidden = $true

  $dashboardSheet.PageSetup.Orientation = 2
  $dashboardSheet.PageSetup.Zoom = $false
  $dashboardSheet.PageSetup.FitToPagesWide = 1
  $dashboardSheet.PageSetup.FitToPagesTall = 1
  $dashboardSheet.PageSetup.PrintArea = '$B$2:$M$31'

  $workbook.Worksheets.Item("README").Range("B16").Value2 = "6."
  $workbook.Worksheets.Item("README").Range("C16").Value2 = "Budget Charts tab"
  $workbook.Worksheets.Item("README").Range("D16").Value2 = "Executive budget visuals for Excel. Connect Power BI to the Contractors, Budget, Invoices, and Change Log tables for the full interactive report."

  $workbook.Save()
  Write-Output "Workbook updated successfully."
  Write-Output "Backup created at: $backupPath"
}
finally {
  if ($null -ne $workbook) {
    $workbook.Close($true)
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
  }

  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';

export interface ExcelExportOptions {
  reportTitle: string;
  propertyName: string;
  outletName: string;
  auditPeriod: string;
  exportedBy: string;
  currencyCode?: string;
  selectedTypeBadge?: string;
  signatoryConfig?: {
    prepared?: string;
    reviewed?: string;
    approved?: string;
  } | null;
}

// Color Palette matching the UI & Print Report styling
const COLORS = {
  headerBg: 'FF0F172A', // Slate 900
  headerText: 'FFFFFFFF', // White
  subHeaderBg: 'FFEEF2FF', // Indigo 50
  subHeaderText: 'FF3730A3', // Indigo 800
  catHeaderBg: 'FFE2E8F0', // Slate 200
  catHeaderText: 'FF0F172A', // Slate 900
  accentIndigo: 'FF4338CA', // Indigo 700
  accentGold: 'FFD97706', // Amber 600
  lightAmber: 'FFFEF3C7', // Amber 100
  lightSky: 'FFE0F2FE', // Sky 100
  lightEmerald: 'FFDCFCE7', // Emerald 100
  darkEmerald: 'FF166534', // Emerald 800
  grandTotalBg: 'FFE0E7FF', // Indigo 100
  grandTotalText: 'FF1E1B4B', // Indigo 950
  totalRowBg: 'FFF8FAFC', // Slate 50
  borderColor: 'FFCBD5E1', // Slate 300
  darkBorder: 'FF0F172A', // Slate 900
  zebraBg: 'FFF8FAFC', // Slate 50
  textMuted: 'FF64748B', // Slate 500
};

/**
 * Applies professional header branding, property info, title, and metadata
 */
function applyReportHeader(
  sheet: ExcelJS.Worksheet,
  options: ExcelExportOptions,
  totalColumns: number
): number {
  const maxCol = Math.max(totalColumns, 8);

  // Row 1: Empty spacing
  sheet.addRow([]);

  // Row 2: Property & Certification
  const propRow = sheet.addRow([
    options.propertyName.toUpperCase(),
    ...Array(maxCol - 1).fill('')
  ]);
  propRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: COLORS.headerBg } };
  propRow.height = 24;

  // Row 3: Outlet Name & Standards
  const outletRow = sheet.addRow([
    `${options.outletName.toUpperCase()} • ISO-9001 CERTIFIED • INTERNAL VERIFICATION`,
    ...Array(maxCol - 1).fill('')
  ]);
  outletRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.textMuted } };

  // Row 4: Empty space
  sheet.addRow([]);

  // Row 5: Report Title Banner
  const titleRow = sheet.addRow([
    options.reportTitle.toUpperCase(),
    ...Array(maxCol - 1).fill('')
  ]);
  titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: COLORS.accentIndigo } };
  titleRow.height = 22;

  // Row 6: Metadata row (Selected type & Audit Period)
  const metaText = `AUDIT PERIOD: ${options.auditPeriod.toUpperCase()}${options.selectedTypeBadge ? `  |  FILTER: ${options.selectedTypeBadge.toUpperCase()}` : ''}  |  STATUS: VERIFIED AUDIT TRAIL`;
  const metaRow = sheet.addRow([metaText, ...Array(maxCol - 1).fill('')]);
  metaRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  metaRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.subHeaderBg }
  };
  metaRow.getCell(1).border = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
  sheet.mergeCells(metaRow.number, 1, metaRow.number, maxCol);
  metaRow.height = 20;

  // Row 7: Empty space before table
  sheet.addRow([]);

  return 8; // Next available row
}

/**
 * Formats a table header row with deep navy background and crisp white bold text
 */
function styleTableHeader(row: ExcelJS.Row, colCount: number) {
  row.height = 26;
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.darkBorder } },
      bottom: { style: 'medium', color: { argb: COLORS.darkBorder } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  }
}

/**
 * Styles a grand total row with double bottom border
 */
function styleGrandTotalRow(row: ExcelJS.Row, colCount: number) {
  row.height = 24;
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.grandTotalText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.grandTotalBg }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.darkBorder } },
      bottom: { style: 'double', color: { argb: COLORS.darkBorder } },
      left: { style: 'thin', color: { argb: COLORS.borderColor } },
      right: { style: 'thin', color: { argb: COLORS.borderColor } },
    };
  }
}

/**
 * Adds signatory approval boxes and export timestamp footer at the bottom of the worksheet
 */
function applyReportFooter(
  sheet: ExcelJS.Worksheet,
  options: ExcelExportOptions,
  totalColumns: number
) {
  const maxCol = Math.max(totalColumns, 8);

  // Spacing
  sheet.addRow([]);
  sheet.addRow([]);

  // Signatories section if configured
  if (options.signatoryConfig) {
    const { prepared, reviewed, approved } = options.signatoryConfig;
    const hasReviewed = Boolean(reviewed && reviewed.trim());

    const signHeaderRow = sheet.addRow(['EXECUTIVE AUTHORIZATION & SIGNATORIES', ...Array(maxCol - 1).fill('')]);
    signHeaderRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.textMuted } };
    
    sheet.addRow([]);
    sheet.addRow([]);

    // Signature lines
    if (hasReviewed) {
      const colWidth = Math.floor(maxCol / 3);
      const signLineRow = sheet.addRow(['____________________________', '', '____________________________', '', '____________________________']);
      signLineRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.darkBorder } };
      
      const signLabelRow = sheet.addRow(['PREPARED BY:', '', 'REVIEWED BY:', '', 'APPROVED BY:']);
      signLabelRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.darkBorder } };

      const signNameRow = sheet.addRow([prepared || 'Accountant', '', reviewed || '', '', approved || 'General Manager']);
      signNameRow.font = { name: 'Arial', size: 8.5, color: { argb: COLORS.textMuted } };
    } else {
      const signLineRow = sheet.addRow(['____________________________________', '', '', '', '____________________________________']);
      signLineRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.darkBorder } };

      const signLabelRow = sheet.addRow(['PREPARED BY:', '', '', '', 'APPROVED BY:']);
      signLabelRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.darkBorder } };

      const signNameRow = sheet.addRow([prepared || 'Accountant', '', '', '', approved || 'General Manager']);
      signNameRow.font = { name: 'Arial', size: 8.5, color: { argb: COLORS.textMuted } };
    }
  }

  // Footer metadata
  sheet.addRow([]);
  sheet.addRow([]);
  const footerRow = sheet.addRow([
    `OFFICIAL AUDIT REPORT  •  EXPORTED ON: ${format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} BY ${options.exportedBy.toUpperCase()}  •  © ${new Date().getFullYear()} ${options.propertyName.toUpperCase()}`,
    ...Array(maxCol - 1).fill('')
  ]);
  footerRow.getCell(1).font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.textMuted } };
  sheet.mergeCells(footerRow.number, 1, footerRow.number, maxCol);
}

/**
 * Configures worksheet view, print properties, and fits column widths
 */
function finalizeWorksheet(sheet: ExcelJS.Worksheet, minColWidths: Record<number, number> = {}) {
  // Setup print settings
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
    showGridLines: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3
    }
  };

  sheet.views = [{ showGridLines: true }];

  // Auto calculate column widths
  sheet.columns.forEach((column, colIdx) => {
    let maxLength = minColWidths[colIdx + 1] || 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      // Don't calculate width from merged rows or long banners in column 1
      if (cell.row <= 7 || cell.row > sheet.rowCount - 5) return;
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLength && valStr.length < 50) {
        maxLength = valStr.length;
      }
    });
    column.width = Math.min(Math.max(maxLength + 3, 10), 45);
  });
}

/**
 * Triggers browser download of the Excel workbook
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 1. REVENUE RECOGNITION AUDIT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportRevenueRecognitionExcel(
  rows: any[],
  options: ExcelExportOptions,
  selectedMembershipTypeId: string = 'all'
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Revenue Recognition');
  const totalCols = 12;

  applyReportHeader(sheet, options, totalCols);

  // Columns: Sl.No | Member Name | Mem No | Start Date | End Date | Total Days | Daily Rate | Actual Rate | Discount | Net Fees | Prev Accrual | Period Rev | Deferred
  const headers = [
    'SL.',
    'GUEST / MEMBER PROFILE',
    'MEM. NO',
    'START DATE',
    'END DATE',
    'DAYS',
    'DAILY RATE',
    'ACTUAL RATE',
    'DISCOUNT',
    'NET FEES',
    'PREV. ACCRUAL',
    'PERIOD REVENUE',
    'DEFERRED'
  ];

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  // Group rows by Type and Category
  const grouped = rows.reduce((acc, row) => {
    const typeKey = selectedMembershipTypeId === 'all' ? (row.membership_type_name || 'Membership') : 'All';
    const catKey = row.category_name || 'Other';
    if (!acc[typeKey]) acc[typeKey] = {};
    if (!acc[typeKey][catKey]) acc[typeKey][catKey] = [];
    acc[typeKey][catKey].push(row);
    return acc;
  }, {} as Record<string, Record<string, any[]>>);

  let grandActual = 0;
  let grandDiscount = 0;
  let grandNetFees = 0;
  let grandPrevAccrual = 0;
  let grandPeriodRev = 0;
  let grandDeferred = 0;
  let slCounter = 1;

  for (const [typeKey, categories] of Object.entries(grouped)) {
    if (selectedMembershipTypeId === 'all') {
      const typeRow = sheet.addRow([`MEMBERSHIP TYPE: ${typeKey.toUpperCase()}`, ...Array(headers.length - 1).fill('')]);
      typeRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      typeRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentIndigo } };
      sheet.mergeCells(typeRow.number, 1, typeRow.number, headers.length);
      typeRow.height = 22;
    }

    for (const [catName, catRows] of Object.entries(categories)) {
      // Category Divider
      const catRow = sheet.addRow([`CATEGORY: ${catName.toUpperCase()} (${catRows.length} RECORDS)`, ...Array(headers.length - 1).fill('')]);
      catRow.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.catHeaderText } };
      catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.catHeaderBg } };
      sheet.mergeCells(catRow.number, 1, catRow.number, headers.length);
      catRow.height = 20;

      let catActual = 0;
      let catDiscount = 0;
      let catNetFees = 0;
      let catPrevAccrual = 0;
      let catPeriodRev = 0;
      let catDeferred = 0;

      catRows.forEach((r, idx) => {
        catActual += Number(r.actual_rate) || 0;
        catDiscount += Number(r.discount) || 0;
        catNetFees += Number(r.net_fees) || 0;
        catPrevAccrual += Number(r.prev_accrual) || 0;
        catPeriodRev += Number(r.period_rev) || 0;
        catDeferred += Number(r.deferred) || 0;

        const dataRow = sheet.addRow([
          slCounter++,
          r.guest_name || '',
          r.membership_no || '',
          r.start_date || '',
          r.end_date || '',
          Number(r.total_days) || 0,
          Number(r.daily_rate) || 0,
          Number(r.actual_rate) || 0,
          Number(r.discount) || 0,
          Number(r.net_fees) || 0,
          Number(r.prev_accrual) || 0,
          Number(r.period_rev) || 0,
          Number(r.deferred) || 0,
        ]);

        dataRow.height = 19;
        dataRow.getCell(1).alignment = { horizontal: 'center' };
        dataRow.getCell(3).alignment = { horizontal: 'center' };
        dataRow.getCell(4).alignment = { horizontal: 'center' };
        dataRow.getCell(5).alignment = { horizontal: 'center' };
        dataRow.getCell(6).alignment = { horizontal: 'center' };
        dataRow.getCell(6).numFmt = '#,##0';

        // Numbers 7 to 13 formatted as currency
        for (let c = 7; c <= 13; c++) {
          const cell = dataRow.getCell(c);
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }

        // Borders and alternating colors
        for (let c = 1; c <= headers.length; c++) {
          const cell = dataRow.getCell(c);
          cell.font = { name: 'Arial', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.borderColor } },
            bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
            left: { style: 'thin', color: { argb: COLORS.borderColor } },
            right: { style: 'thin', color: { argb: COLORS.borderColor } },
          };
          if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
          }
        }
      });

      grandActual += catActual;
      grandDiscount += catDiscount;
      grandNetFees += catNetFees;
      grandPrevAccrual += catPrevAccrual;
      grandPeriodRev += catPeriodRev;
      grandDeferred += catDeferred;

      // Category Subtotal Row
      const subRow = sheet.addRow([
        '',
        `SUBTOTAL ${catName.toUpperCase()}`,
        '',
        '',
        '',
        '',
        '',
        catActual,
        catDiscount,
        catNetFees,
        catPrevAccrual,
        catPeriodRev,
        catDeferred
      ]);

      subRow.height = 20;
      for (let c = 1; c <= headers.length; c++) {
        const cell = subRow.getCell(c);
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.headerBg } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.darkBorder } },
          bottom: { style: 'thin', color: { argb: COLORS.darkBorder } },
        };
        if (c >= 8) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      }
    }
  }

  // Grand Total Row
  const grandRow = sheet.addRow([
    '',
    'PORTFOLIO GRAND TOTAL',
    '',
    '',
    '',
    '',
    '',
    grandActual,
    grandDiscount,
    grandNetFees,
    grandPrevAccrual,
    grandPeriodRev,
    grandDeferred
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  for (let c = 8; c <= headers.length; c++) {
    grandRow.getCell(c).numFmt = '#,##0.00';
    grandRow.getCell(c).alignment = { horizontal: 'right' };
  }

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 2: 24, 8: 14, 9: 14, 10: 14, 11: 14, 12: 15, 13: 14 });
  await downloadWorkbook(workbook, 'Revenue_Recognition_Audit');
}

// -------------------------------------------------------------
// 2. INCENTIVE AUDIT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportIncentivesExcel(
  rows: any[],
  summary: any,
  activeStaffList: any[],
  incentiveDept: string,
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`${incentiveDept} Incentives`);

  const headers = [
    'SL.',
    'DATE',
    'GUEST / MEMBER',
    'CHECK NO.',
    'ITEM / SERVICE',
    'SPECIALIST / THERAPIST',
    'GROSS AMOUNT',
    'DISC %',
    'DISC. AMT',
    'NET REVENUE',
    'INC. TOTAL',
    'INC. DISC %',
    'INC. NET YIELD',
    'REMARKS'
  ];

  // If staff splits are present, append staff columns
  const staffCols = activeStaffList.map(s => s.name.toUpperCase());
  const allHeaders = [...headers, ...staffCols];

  applyReportHeader(sheet, options, allHeaders.length);

  const headerRow = sheet.addRow(allHeaders);
  styleTableHeader(headerRow, allHeaders.length);

  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalIncGross = 0;
  let totalIncNet = 0;
  const staffTotals: Record<string, number> = {};
  activeStaffList.forEach(s => { staffTotals[s.id] = 0; });

  rows.forEach((r, idx) => {
    totalGross += Number(r.actual_price) || 0;
    totalDiscount += Number(r.discount_amount) || 0;
    totalNet += Number(r.net_revenue) || 0;
    totalIncGross += Number(r.inc_total) || 0;
    totalIncNet += Number(r.inc_net) || 0;

    const staffValues = activeStaffList.map(s => {
      const amt = Number(r.staff_splits?.[s.id]) || 0;
      staffTotals[s.id] += amt;
      return amt;
    });

    const dataRow = sheet.addRow([
      idx + 1,
      r.date || '',
      r.guest_name || '',
      r.check_no || '',
      r.item_name || '',
      r.therapist_name || '',
      Number(r.actual_price) || 0,
      (Number(r.discount_percent) || 0) / 100,
      Number(r.discount_amount) || 0,
      Number(r.net_revenue) || 0,
      Number(r.inc_total) || 0,
      (Number(r.inc_discount_percent) || 0) / 100,
      Number(r.inc_net) || 0,
      r.remarks || '',
      ...staffValues
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(2).alignment = { horizontal: 'center' };
    dataRow.getCell(4).alignment = { horizontal: 'center' };

    // Currency columns
    [7, 9, 10, 11, 13].forEach(c => {
      dataRow.getCell(c).numFmt = '#,##0.00';
      dataRow.getCell(c).alignment = { horizontal: 'right' };
    });

    // Percent columns
    [8, 12].forEach(c => {
      dataRow.getCell(c).numFmt = '0.0%';
      dataRow.getCell(c).alignment = { horizontal: 'right' };
    });

    // Staff columns
    for (let sIdx = 0; sIdx < activeStaffList.length; sIdx++) {
      const cell = dataRow.getCell(headers.length + 1 + sIdx);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }

    for (let c = 1; c <= allHeaders.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  // Grand Total Row
  const staffTotalValues = activeStaffList.map(s => staffTotals[s.id] || 0);
  const grandRow = sheet.addRow([
    '',
    'AUDIT GRAND TOTALS',
    '',
    '',
    '',
    '',
    totalGross,
    '',
    totalDiscount,
    totalNet,
    totalIncGross,
    '',
    totalIncNet,
    '',
    ...staffTotalValues
  ]);
  styleGrandTotalRow(grandRow, allHeaders.length);

  [7, 9, 10, 11, 13].forEach(c => {
    grandRow.getCell(c).numFmt = '#,##0.00';
    grandRow.getCell(c).alignment = { horizontal: 'right' };
  });
  for (let sIdx = 0; sIdx < activeStaffList.length; sIdx++) {
    const cell = grandRow.getCell(headers.length + 1 + sIdx);
    cell.numFmt = '#,##0.00';
    cell.alignment = { horizontal: 'right' };
  }

  // Summary KPI Section
  sheet.addRow([]);
  sheet.addRow([]);
  const kpiHeader = sheet.addRow(['INCENTIVE & REVENUE LEDGER SUMMARY', 'AMOUNT']);
  kpiHeader.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.headerText } };
  kpiHeader.getCell(2).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.headerText } };
  kpiHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  kpiHeader.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };

  const addKpiRow = (label: string, value: number, isHighlight: boolean = false) => {
    const r = sheet.addRow([label, value]);
    r.getCell(1).font = { name: 'Arial', size: 9, bold: isHighlight };
    r.getCell(2).font = { name: 'Arial', size: 9.5, bold: isHighlight, color: { argb: isHighlight ? COLORS.accentIndigo : COLORS.darkBorder } };
    r.getCell(2).numFmt = '#,##0.00';
    r.getCell(2).alignment = { horizontal: 'right' };
    r.getCell(1).border = { top: { style: 'thin', color: { argb: COLORS.borderColor } }, bottom: { style: 'thin', color: { argb: COLORS.borderColor } } };
    r.getCell(2).border = { top: { style: 'thin', color: { argb: COLORS.borderColor } }, bottom: { style: 'thin', color: { argb: COLORS.borderColor } } };
    if (isHighlight) {
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightSky } };
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightSky } };
    }
  };

  addKpiRow('PORTFOLIO GROSS REVENUE', totalGross);
  addKpiRow('TOTAL REDUCTION / DISCOUNT', totalDiscount);
  addKpiRow('CERTIFIED NET REVENUE', totalNet, true);
  addKpiRow('TOTAL INCENTIVE YIELD', totalIncNet, true);

  applyReportFooter(sheet, options, allHeaders.length);
  finalizeWorksheet(sheet, { 3: 22, 5: 22, 6: 20, 7: 14, 10: 14, 13: 14 });
  await downloadWorkbook(workbook, `${incentiveDept}_Incentive_Audit`);
}

// -------------------------------------------------------------
// 3. DAILY SALES LEDGER EXCEL EXPORT
// -------------------------------------------------------------
export async function exportDailySalesExcel(
  rows: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daily Sales');
  const headers = [
    'SL.',
    'DATE',
    'GUEST / MEMBER',
    'REFERENCE',
    'CHECK NO.',
    'PAYMENT MODE',
    'ITEM / SERVICE',
    'GROSS AMOUNT',
    'DISC %',
    'DISCOUNT AMT',
    'NET REVENUE',
    'REMARKS'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;

  rows.forEach((r, idx) => {
    totalGross += Number(r.actual_price) || 0;
    totalDiscount += Number(r.discount_amount) || 0;
    totalNet += Number(r.net_revenue) || 0;

    const dataRow = sheet.addRow([
      idx + 1,
      r.date || '',
      r.guest_name || '',
      r.duration || r.type_of_membership || '',
      r.check_no || '',
      r.mode_of_payment || 'Cash',
      r.item_name || '',
      Number(r.actual_price) || 0,
      (Number(r.discount_percent) || 0) / 100,
      Number(r.discount_amount) || 0,
      Number(r.net_revenue) || 0,
      r.remarks || ''
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(2).alignment = { horizontal: 'center' };
    dataRow.getCell(5).alignment = { horizontal: 'center' };
    dataRow.getCell(6).alignment = { horizontal: 'center' };

    dataRow.getCell(8).numFmt = '#,##0.00';
    dataRow.getCell(8).alignment = { horizontal: 'right' };
    dataRow.getCell(9).numFmt = '0.0%';
    dataRow.getCell(9).alignment = { horizontal: 'right' };
    dataRow.getCell(10).numFmt = '#,##0.00';
    dataRow.getCell(10).alignment = { horizontal: 'right' };
    dataRow.getCell(11).numFmt = '#,##0.00';
    dataRow.getCell(11).alignment = { horizontal: 'right' };

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  // Grand Total Row
  const grandRow = sheet.addRow([
    '',
    'DAILY TOTAL',
    '',
    '',
    '',
    '',
    '',
    totalGross,
    '',
    totalDiscount,
    totalNet,
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(8).numFmt = '#,##0.00';
  grandRow.getCell(8).alignment = { horizontal: 'right' };
  grandRow.getCell(10).numFmt = '#,##0.00';
  grandRow.getCell(10).alignment = { horizontal: 'right' };
  grandRow.getCell(11).numFmt = '#,##0.00';
  grandRow.getCell(11).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 3: 24, 7: 24, 8: 14, 10: 14, 11: 14 });
  await downloadWorkbook(workbook, 'Daily_Sales_Report');
}

// -------------------------------------------------------------
// 4. ACTIVE MEMBERS REPORT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportActiveMembersExcel(
  groupedEntries: [string, Record<string, any[]>][],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Active Members');
  const headers = [
    'SL.',
    'MEMBER NAME',
    'MEMBERSHIP NO.',
    'CATEGORY',
    'START DATE',
    'EXPIRY DATE',
    'DAYS LEFT',
    'ACTUAL RATE',
    'DISCOUNT',
    'NET AMOUNT',
    'STATUS',
    'CONTACT'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let sl = 1;
  let totalNet = 0;
  let totalActual = 0;

  for (const [typeKey, categories] of groupedEntries) {
    const typeRow = sheet.addRow([`TYPE: ${typeKey.toUpperCase()}`, ...Array(headers.length - 1).fill('')]);
    typeRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    typeRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentIndigo } };
    sheet.mergeCells(typeRow.number, 1, typeRow.number, headers.length);
    typeRow.height = 22;

    for (const [catKey, memberList] of Object.entries(categories)) {
      const catRow = sheet.addRow([`CATEGORY: ${catKey.toUpperCase()} (${memberList.length} MEMBERS)`, ...Array(headers.length - 1).fill('')]);
      catRow.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.catHeaderText } };
      catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.catHeaderBg } };
      sheet.mergeCells(catRow.number, 1, catRow.number, headers.length);
      catRow.height = 20;

      memberList.forEach((m, idx) => {
        totalActual += Number(m.actual_rate) || 0;
        totalNet += Number(m.net_amount) || 0;

        const dataRow = sheet.addRow([
          sl++,
          m.guest_name || '',
          m.membership_number || '',
          catKey,
          m.start_date || '',
          m.current_end_date || m.original_end_date || '',
          m.current_end_date ? Math.max(0, Math.ceil((new Date(m.current_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : '-',
          Number(m.actual_rate) || 0,
          Number(m.discount) || 0,
          Number(m.net_amount) || 0,
          m.status || 'Active',
          m.phone || m.email || ''
        ]);

        dataRow.height = 19;
        dataRow.getCell(1).alignment = { horizontal: 'center' };
        dataRow.getCell(3).alignment = { horizontal: 'center' };
        dataRow.getCell(5).alignment = { horizontal: 'center' };
        dataRow.getCell(6).alignment = { horizontal: 'center' };
        dataRow.getCell(7).alignment = { horizontal: 'center' };
        dataRow.getCell(11).alignment = { horizontal: 'center' };

        dataRow.getCell(8).numFmt = '#,##0.00';
        dataRow.getCell(8).alignment = { horizontal: 'right' };
        dataRow.getCell(9).numFmt = '#,##0.00';
        dataRow.getCell(9).alignment = { horizontal: 'right' };
        dataRow.getCell(10).numFmt = '#,##0.00';
        dataRow.getCell(10).alignment = { horizontal: 'right' };

        for (let c = 1; c <= headers.length; c++) {
          const cell = dataRow.getCell(c);
          cell.font = { name: 'Arial', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: COLORS.borderColor } },
            bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
            left: { style: 'thin', color: { argb: COLORS.borderColor } },
            right: { style: 'thin', color: { argb: COLORS.borderColor } },
          };
          if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
          }
        }
      });
    }
  }

  // Grand Total Row
  const grandRow = sheet.addRow([
    '',
    'ACTIVE MEMBERS TOTALS',
    '',
    '',
    '',
    '',
    '',
    totalActual,
    '',
    totalNet,
    '',
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(8).numFmt = '#,##0.00';
  grandRow.getCell(8).alignment = { horizontal: 'right' };
  grandRow.getCell(10).numFmt = '#,##0.00';
  grandRow.getCell(10).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 2: 25, 4: 20, 8: 14, 10: 14, 12: 20 });
  await downloadWorkbook(workbook, 'Active_Members_Report');
}

// -------------------------------------------------------------
// 5. EXPIRING MEMBERSHIPS REPORT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportExpiringMembershipsExcel(
  members: any[],
  categories: any[],
  types: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Expiring Memberships');
  const headers = [
    'SL.',
    'MEMBER NAME',
    'MEMBERSHIP NO.',
    'TYPE',
    'CATEGORY',
    'START DATE',
    'EXPIRY DATE',
    'DAYS LEFT',
    'ORIGINAL NET',
    'STATUS',
    'CONTACT / EMAIL'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let totalNet = 0;

  members.forEach((m, idx) => {
    const cat = categories.find(c => c.id === m.category_id)?.name || 'General';
    const type = types.find(t => t.id === m.membership_type_id)?.name || 'General';
    const net = Number(m.net_amount) || 0;
    totalNet += net;

    const daysLeft = m.current_end_date ? Math.ceil((new Date(m.current_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const dataRow = sheet.addRow([
      idx + 1,
      m.guest_name || '',
      m.membership_number || '',
      type,
      cat,
      m.start_date || '',
      m.current_end_date || '',
      daysLeft,
      net,
      m.status || 'Active',
      m.phone || m.email || ''
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(3).alignment = { horizontal: 'center' };
    dataRow.getCell(6).alignment = { horizontal: 'center' };
    dataRow.getCell(7).alignment = { horizontal: 'center' };
    dataRow.getCell(8).alignment = { horizontal: 'center' };
    dataRow.getCell(10).alignment = { horizontal: 'center' };

    dataRow.getCell(9).numFmt = '#,##0.00';
    dataRow.getCell(9).alignment = { horizontal: 'right' };

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  const grandRow = sheet.addRow([
    '',
    'TOTAL EXPIRING PORTFOLIO',
    '',
    '',
    '',
    '',
    '',
    '',
    totalNet,
    '',
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(9).numFmt = '#,##0.00';
  grandRow.getCell(9).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 2: 25, 4: 18, 5: 18, 9: 14, 11: 22 });
  await downloadWorkbook(workbook, 'Expiring_Memberships_Report');
}

// -------------------------------------------------------------
// 6. MASSAGE ROOM REVENUE EXCEL EXPORT
// -------------------------------------------------------------
export async function exportMassageRoomRevenueExcel(
  bookings: any[],
  rooms: any[],
  therapists: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Massage Room Revenue');
  const headers = [
    'SL.',
    'DATE',
    'ROOM / FACILITY',
    'GUEST / CLIENT',
    'SERVICE / MASSAGE',
    'THERAPIST',
    'DURATION',
    'GROSS AMOUNT',
    'DISCOUNT',
    'NET REVENUE',
    'STATUS'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;

  bookings.forEach((b, idx) => {
    const gross = Number(b.price) || 0;
    const disc = Number(b.discount_amount) || 0;
    const net = Number(b.final_amount) || (gross - disc);

    totalGross += gross;
    totalDiscount += disc;
    totalNet += net;

    const dataRow = sheet.addRow([
      idx + 1,
      b.date || '',
      b.room_name || b.room || 'Main Room',
      b.client_name || b.guest_name || '',
      b.service_name || b.massage_type || '',
      b.therapist_name || b.staff_name || '',
      b.duration ? `${b.duration} mins` : '',
      gross,
      disc,
      net,
      b.status || 'Completed'
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(2).alignment = { horizontal: 'center' };
    dataRow.getCell(7).alignment = { horizontal: 'center' };
    dataRow.getCell(11).alignment = { horizontal: 'center' };

    dataRow.getCell(8).numFmt = '#,##0.00';
    dataRow.getCell(8).alignment = { horizontal: 'right' };
    dataRow.getCell(9).numFmt = '#,##0.00';
    dataRow.getCell(9).alignment = { horizontal: 'right' };
    dataRow.getCell(10).numFmt = '#,##0.00';
    dataRow.getCell(10).alignment = { horizontal: 'right' };

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  const grandRow = sheet.addRow([
    '',
    'TOTAL ROOM REVENUE',
    '',
    '',
    '',
    '',
    '',
    totalGross,
    totalDiscount,
    totalNet,
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(8).numFmt = '#,##0.00';
  grandRow.getCell(8).alignment = { horizontal: 'right' };
  grandRow.getCell(9).numFmt = '#,##0.00';
  grandRow.getCell(9).alignment = { horizontal: 'right' };
  grandRow.getCell(10).numFmt = '#,##0.00';
  grandRow.getCell(10).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 3: 20, 4: 24, 5: 22, 6: 20, 8: 14, 10: 14 });
  await downloadWorkbook(workbook, 'Massage_Room_Revenue_Report');
}

// -------------------------------------------------------------
// 7. MONTHLY REVENUE REPORT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportMonthlyRevenueExcel(
  data: any,
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const modeLabel = data?.revenueMode === 'cash' ? 'Cash Basis' : 'Accrual / Amortization';
  const sheet = workbook.addWorksheet(`Monthly Revenue (${modeLabel})`);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const headers = ['REVENUE STREAM / CATEGORY', ...months, 'YTD TOTAL'];

  applyReportHeader(sheet, {
    ...options,
    selectedTypeBadge: `ACCOUNTING MODE: ${modeLabel.toUpperCase()}`
  }, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  const currentYear = data?.year || new Date().getFullYear();
  const prevYear = currentYear - 1;

  // Stream / Category Rows
  const rows = data?.rows || [];
  rows.forEach((r: any, idx: number) => {
    const vals = (r.values || []).map((v: number) => Number(v) || 0);
    const rowTotal = Number(r.total) || vals.reduce((a: number, b: number) => a + b, 0);

    const dataRow = sheet.addRow([r.category || 'Revenue', ...vals, rowTotal]);
    dataRow.height = 20;

    dataRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.headerBg } };

    for (let c = 2; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
      cell.font = { name: 'Arial', size: 9 };
      if (c === headers.length) {
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    }

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1 && c < headers.length) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  // Monthly Totals for Current Year
  const currentTotals = data?.monthlyTotals || Array(12).fill(0);
  const currentYearlyTotal = data?.yearlyTotal || currentTotals.reduce((a: number, b: number) => a + b, 0);

  const totalRow = sheet.addRow([`TOTAL REVENUE (${currentYear})`, ...currentTotals, currentYearlyTotal]);
  styleGrandTotalRow(totalRow, headers.length);
  for (let c = 2; c <= headers.length; c++) {
    totalRow.getCell(c).numFmt = '#,##0.00';
    totalRow.getCell(c).alignment = { horizontal: 'right' };
  }

  // Previous Year Comparison
  if (data?.previousYearTotals && data.previousYearTotals.length > 0) {
    sheet.addRow([]);
    const prevHeaderRow = sheet.addRow([`HISTORICAL BENCHMARK: PREVIOUS YEAR (${prevYear})`, ...Array(headers.length - 1).fill('')]);
    prevHeaderRow.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLORS.textMuted } };
    sheet.mergeCells(prevHeaderRow.number, 1, prevHeaderRow.number, headers.length);

    const prevTotals = data.previousYearTotals;
    const prevYearlyTotal = data?.previousYearlyTotal || prevTotals.reduce((a: number, b: number) => a + b, 0);

    const prevRow = sheet.addRow([`TOTAL REVENUE (${prevYear})`, ...prevTotals, prevYearlyTotal]);
    prevRow.height = 20;
    for (let c = 1; c <= headers.length; c++) {
      const cell = prevRow.getCell(c);
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.textMuted } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (c >= 2) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    }

    // YoY Growth Variance Row
    const varianceValues = months.map((_, i) => {
      const curr = currentTotals[i] || 0;
      const prev = prevTotals[i] || 0;
      return curr - prev;
    });
    const totalVariance = currentYearlyTotal - prevYearlyTotal;
    const varianceRow = sheet.addRow(['YoY NET VARIANCE', ...varianceValues, totalVariance]);
    varianceRow.height = 20;
    for (let c = 1; c <= headers.length; c++) {
      const cell = varianceRow.getCell(c);
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.accentIndigo } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'medium', color: { argb: COLORS.accentIndigo } },
      };
      if (c >= 2) {
        cell.numFmt = '#,##0.00;[Red]-#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    }
  }

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 1: 30 });
  await downloadWorkbook(workbook, `Monthly_Revenue_${currentYear}_${data?.revenueMode || 'cash'}`);
}

// -------------------------------------------------------------
// 8. RETAIL STOCK AUDIT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportRetailStockExcel(
  items: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Retail Inventory Audit');
  const headers = [
    'SL.',
    'ITEM DESCRIPTION',
    'CATEGORY',
    'UNIT PRICE',
    'OPENING',
    'SOLD',
    'SALES REVENUE',
    'RESTOCKED',
    'ADJUSTMENTS',
    'CLOSING STOCK',
    'VALUATION',
    'STATUS'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let totalSalesRev = 0;
  let totalValuation = 0;
  let totalSoldUnits = 0;
  let totalClosingUnits = 0;

  items.forEach((item, idx) => {
    const unitPrice = Number(item.unitPrice) || 0;
    const sold = Number(item.sold) || 0;
    const rev = Number(item.salesRevenue) || (sold * unitPrice);
    const closing = Number(item.closingStock) || 0;
    const val = Number(item.closingValue) || (closing * unitPrice);

    totalSalesRev += rev;
    totalValuation += val;
    totalSoldUnits += sold;
    totalClosingUnits += closing;

    const dataRow = sheet.addRow([
      idx + 1,
      item.itemName || '',
      item.category || 'General',
      unitPrice,
      Number(item.openingStock) || 0,
      sold,
      rev,
      Number(item.restocked) || 0,
      Number(item.adjustments) || 0,
      closing,
      val,
      item.status || 'Good'
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(3).alignment = { horizontal: 'center' };
    dataRow.getCell(5).alignment = { horizontal: 'center' };
    dataRow.getCell(6).alignment = { horizontal: 'center' };
    dataRow.getCell(8).alignment = { horizontal: 'center' };
    dataRow.getCell(9).alignment = { horizontal: 'center' };
    dataRow.getCell(10).alignment = { horizontal: 'center' };
    dataRow.getCell(12).alignment = { horizontal: 'center' };

    dataRow.getCell(4).numFmt = '#,##0.00';
    dataRow.getCell(4).alignment = { horizontal: 'right' };
    dataRow.getCell(7).numFmt = '#,##0.00';
    dataRow.getCell(7).alignment = { horizontal: 'right' };
    dataRow.getCell(11).numFmt = '#,##0.00';
    dataRow.getCell(11).alignment = { horizontal: 'right' };

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  const grandRow = sheet.addRow([
    '',
    'PORTFOLIO INVENTORY TOTALS',
    '',
    '',
    '',
    totalSoldUnits,
    totalSalesRev,
    '',
    '',
    totalClosingUnits,
    totalValuation,
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(7).numFmt = '#,##0.00';
  grandRow.getCell(7).alignment = { horizontal: 'right' };
  grandRow.getCell(11).numFmt = '#,##0.00';
  grandRow.getCell(11).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 2: 26, 3: 18, 4: 14, 7: 15, 11: 15 });
  await downloadWorkbook(workbook, 'Retail_Inventory_Stock_Audit');
}

// -------------------------------------------------------------
// 8. CUSTOM REPORT EXCEL EXPORT
// -------------------------------------------------------------
export async function exportCustomReportExcel(
  columns: { key: string; label: string; type?: string }[],
  data: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Custom Intelligence');
  const headers = ['SL.', ...columns.map(c => c.label.toUpperCase())];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  data.forEach((row, idx) => {
    const rowValues = columns.map(col => {
      const val = row[col.key];
      if (col.type === 'currency' || col.type === 'number') {
        return Number(val) || 0;
      }
      return val !== null && val !== undefined ? String(val) : '';
    });

    const dataRow = sheet.addRow([idx + 1, ...rowValues]);
    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };

    columns.forEach((col, cIdx) => {
      const cell = dataRow.getCell(cIdx + 2);
      if (col.type === 'currency') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (col.type === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (col.type === 'date') {
        cell.alignment = { horizontal: 'center' };
      }
    });

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 2: 24, 3: 20 });
  await downloadWorkbook(workbook, `${options.reportTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')}`);
}

// -------------------------------------------------------------
// 9. MEMBERS JOINED / REGISTRATION LOG EXCEL EXPORT
// -------------------------------------------------------------
export async function exportMembersJoinedExcel(
  rows: any[],
  options: ExcelExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.exportedBy;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Members Joined');
  const headers = [
    'SL.',
    'JOIN DATE',
    'MEMBER NAME',
    'MEMBERSHIP NO.',
    'CATEGORY / DURATION',
    'CHECK NO.',
    'PAYMENT MODE',
    'GROSS FEES',
    'DISC %',
    'DISCOUNT AMT',
    'NET FEES',
    'REMARKS'
  ];

  applyReportHeader(sheet, options, headers.length);

  const headerRow = sheet.addRow(headers);
  styleTableHeader(headerRow, headers.length);

  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;

  rows.forEach((r, idx) => {
    totalGross += Number(r.actual_price) || 0;
    totalDiscount += Number(r.discount_amount) || 0;
    totalNet += Number(r.net_revenue) || 0;

    const dataRow = sheet.addRow([
      idx + 1,
      r.date || '',
      r.guest_name || '',
      r.check_no || '',
      r.duration || r.type_of_membership || '',
      r.check_no || '',
      r.mode_of_payment || 'Card / Transfer',
      Number(r.actual_price) || 0,
      (Number(r.discount_percent) || 0) / 100,
      Number(r.discount_amount) || 0,
      Number(r.net_revenue) || 0,
      r.remarks || ''
    ]);

    dataRow.height = 19;
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(2).alignment = { horizontal: 'center' };
    dataRow.getCell(4).alignment = { horizontal: 'center' };

    dataRow.getCell(8).numFmt = '#,##0.00';
    dataRow.getCell(8).alignment = { horizontal: 'right' };
    dataRow.getCell(9).numFmt = '0.0%';
    dataRow.getCell(9).alignment = { horizontal: 'right' };
    dataRow.getCell(10).numFmt = '#,##0.00';
    dataRow.getCell(10).alignment = { horizontal: 'right' };
    dataRow.getCell(11).numFmt = '#,##0.00';
    dataRow.getCell(11).alignment = { horizontal: 'right' };

    for (let c = 1; c <= headers.length; c++) {
      const cell = dataRow.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraBg } };
      }
    }
  });

  const grandRow = sheet.addRow([
    '',
    'TOTAL ACQUISITIONS',
    '',
    '',
    '',
    '',
    '',
    totalGross,
    '',
    totalDiscount,
    totalNet,
    ''
  ]);
  styleGrandTotalRow(grandRow, headers.length);
  grandRow.getCell(8).numFmt = '#,##0.00';
  grandRow.getCell(8).alignment = { horizontal: 'right' };
  grandRow.getCell(10).numFmt = '#,##0.00';
  grandRow.getCell(10).alignment = { horizontal: 'right' };
  grandRow.getCell(11).numFmt = '#,##0.00';
  grandRow.getCell(11).alignment = { horizontal: 'right' };

  applyReportFooter(sheet, options, headers.length);
  finalizeWorksheet(sheet, { 3: 24, 5: 22, 8: 14, 10: 14, 11: 14 });
  await downloadWorkbook(workbook, 'Membership_Acquisition_Report');
}

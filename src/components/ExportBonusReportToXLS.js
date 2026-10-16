import ExcelJS from "exceljs";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const asMonthKey = (value) => String(value).slice(0, 7);
const asNumber = (value) => Number(value || 0);

function monthRange(fromPmonth, toPmonth) {
  const start = new Date(`${asMonthKey(fromPmonth)}-01T00:00:00`);
  const end = new Date(`${asMonthKey(toPmonth)}-01T00:00:00`);
  const months = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_FORMAT.format(cursor).toUpperCase().replace(" ", "-"),
    });
  }
  return months;
}

function groupEmployees(rows) {
  const employees = new Map();
  rows.forEach((row) => {
    if (!employees.has(row.EmployeeCode)) {
      employees.set(row.EmployeeCode, { ...row, months: {} });
    }
    employees.get(row.EmployeeCode).months[asMonthKey(row.PMonth)] = {
      bonusBase: asNumber(row.BonusBase),
      bonusAmount: asNumber(row.BonusAmount),
      days: asNumber(row.Days),
      arrearDays: asNumber(row.ArrearDays),
    };
  });
  return [...employees.values()];
}

function toExcelDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function exportBonusReportToXLS({
  rows,
  fromPmonth,
  toPmonth,
  billingType,
}) {
  if (!rows?.length) throw new Error("No bonus data found for the selected period");

  const months = monthRange(fromPmonth, toPmonth);
  const employees = groupEmployees(rows);
  const fixedHeaders = [
    "Employee Code", "Employee Name", "Designation", "Department",
    "Location", "Business Unit", "Date of Joining", "Last Working Date",
  ];
  const totalHeaders = ["Total Bonus Base", "Total Bonus", "Total Paid Days", "Total Arrear Days"];
  const totalColumns = fixedHeaders.length + months.length * 4 + totalHeaders.length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BFCL Payroll System";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Bonus Report", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 6 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.pageSetup.printTitlesRow = "1:6";
  sheet.headerFooter.oddFooter = "Page &P of &N";

  const companyName = rows[0].CompanyName || "Bihar Foundry and Castings Ltd";
  const periodLabel = `${months[0].label} TO ${months[months.length - 1].label}`;
  sheet.mergeCells(1, 1, 1, totalColumns);
  sheet.getCell(1, 1).value = companyName;
  sheet.mergeCells(2, 1, 2, totalColumns);
  sheet.getCell(2, 1).value = `BONUS REPORT — ${periodLabel}`;
  sheet.mergeCells(3, 1, 3, totalColumns);
  sheet.getCell(3, 1).value = `Billing Cycle: ${billingType}`;

  [1, 2, 3].forEach((rowNo) => {
    const cell = sheet.getCell(rowNo, 1);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { name: "Calibri", bold: true, size: rowNo === 1 ? 16 : rowNo === 2 ? 13 : 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNo === 1 ? "FF17365D" : "FF244A73" } };
  });
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 20;

  let col = 1;
  fixedHeaders.forEach((header) => {
    sheet.mergeCells(5, col, 6, col);
    sheet.getCell(5, col).value = header;
    col += 1;
  });
  months.forEach((month) => {
    sheet.mergeCells(5, col, 5, col + 3);
    sheet.getCell(5, col).value = month.label;
    ["Bonus Base", "Bonus Amt", "Days", "Arrear Days"].forEach((header, index) => {
      sheet.getCell(6, col + index).value = header;
    });
    col += 4;
  });
  totalHeaders.forEach((header) => {
    sheet.mergeCells(5, col, 6, col);
    sheet.getCell(5, col).value = header;
    col += 1;
  });

  const headerRange = sheet.getRows(5, 2);
  headerRange.forEach((row) => row.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cell.row === 5 ? "FF2F75B5" : "FF5B9BD5" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9E2F3" } },
      left: { style: "thin", color: { argb: "FFD9E2F3" } },
      bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
      right: { style: "thin", color: { argb: "FFD9E2F3" } },
    };
  }));
  sheet.getRow(5).height = 24;
  sheet.getRow(6).height = 32;

  employees.forEach((employee, index) => {
    const values = [
      employee.EmployeeCode,
      employee.EmployeeName,
      employee.Designation,
      employee.Department,
      employee.LocationName,
      employee.BusinessUnit,
      toExcelDate(employee.DOJ),
      toExcelDate(employee.LastWorkingDate),
    ];
    let totalBase = 0;
    let totalBonus = 0;
    let totalDays = 0;
    let totalArrearDays = 0;
    months.forEach(({ key }) => {
      const month = employee.months[key] || { bonusBase: 0, bonusAmount: 0, days: 0, arrearDays: 0 };
      values.push(month.bonusBase, month.bonusAmount, month.days, month.arrearDays);
      totalBase += month.bonusBase;
      totalBonus += month.bonusAmount;
      totalDays += month.days;
      totalArrearDays += month.arrearDays;
    });
    values.push(totalBase, totalBonus, totalDays, totalArrearDays);
    const row = sheet.addRow(values);
    row.height = 19;
    row.eachCell((cell, cellCol) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: cellCol > 8 ? "right" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFF4F8FC" : "FFFFFFFF" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD9E2F3" } } };
    });
    row.getCell(7).numFmt = "dd/mm/yyyy";
    row.getCell(8).numFmt = "dd/mm/yyyy";
    for (let c = 9; c <= totalColumns; c += 1) row.getCell(c).numFmt = "#,##0.00";
  });

  const firstDataRow = 7;
  const lastDataRow = firstDataRow + employees.length - 1;
  const grandTotal = sheet.addRow(["GRAND TOTAL"]);
  sheet.mergeCells(grandTotal.number, 1, grandTotal.number, 8);
  for (let c = 9; c <= totalColumns; c += 1) {
    grandTotal.getCell(c).value = { formula: `SUM(${sheet.getColumn(c).letter}${firstDataRow}:${sheet.getColumn(c).letter}${lastDataRow})` };
    grandTotal.getCell(c).numFmt = "#,##0.00";
  }
  grandTotal.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
    cell.alignment = { horizontal: cell.column <= 8 ? "right" : "right", vertical: "middle" };
  });
  grandTotal.height = 22;

  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: lastDataRow, column: totalColumns } };
  [12, 24, 20, 24, 18, 20, 14, 16].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  for (let c = 9; c <= totalColumns; c += 1) sheet.getColumn(c).width = 13;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Bonus_Report_${asMonthKey(fromPmonth)}_to_${asMonthKey(toPmonth)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

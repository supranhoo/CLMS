import * as XLSX from "xlsx";

export const LOCAL_DATA_NOTICE = "LOCAL DEVELOPMENT REPLICA - FICTIONAL SAMPLE DATA";

const safeSheetName = (name) => String(name || "Data").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31);
const cellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
};

// Explicit columns prevent internal flags and identifiers from accidentally
// becoming exported columns. String cells remain text, including leading =/+.
export function buildExportWorkbook({ title, columns, rows, metadata = {}, sheetName = "Data", generatedAt = new Date() }) {
  if (!Array.isArray(columns) || !columns.length || columns.some((column) => !column.key || !column.label)) {
    throw new Error("Export columns must have a key and label.");
  }
  if (!Array.isArray(rows) || !rows.length) throw new Error("There are no displayed records to export.");

  const workbook = XLSX.utils.book_new();
  const data = [columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => cellValue(row[column.key])))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = columns.map((column, index) => ({ wch: Math.min(55, Math.max(14, ...data.map((row) => String(row[index] ?? "").length + 2))) }));
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(sheetName) === "Metadata" ? "Data" : safeSheetName(sheetName));

  const details = [
    ["Field", "Value"],
    ["Environment", LOCAL_DATA_NOTICE],
    ["Report", title || "Local data export"],
    ["Generated at (UTC)", new Date(generatedAt).toISOString()],
    ["Record count", rows.length],
    ["Scope", "Current filtered results across all pages"],
    ...Object.entries(metadata).map(([key, value]) => [key, cellValue(value)]),
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(details);
  metaSheet["!cols"] = [{ wch: 32 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, "Metadata");
  workbook.Props = { Title: title || "Local data export", Subject: LOCAL_DATA_NOTICE, CreatedDate: new Date(generatedAt) };
  return workbook;
}

export function downloadWorkbook(options, filename) {
  const workbook = buildExportWorkbook(options);
  const safeFilename = String(filename || "CLMS-local-data").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.xlsx?$/i, "");
  XLSX.writeFile(workbook, `${safeFilename}.xlsx`, { bookType: "xlsx", compression: true });
  return workbook;
}

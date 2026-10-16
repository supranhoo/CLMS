import * as XLSX from 'xlsx';

const dateFields = new Set(['doj', 'dob', 'dateof_birth', 'date_of_birth', 'eff_date', 'joining_date']);

function spreadsheetDate(value, field, date1904) {
  const parts = XLSX.SSF.parse_date_code(value, { date1904 });
  if (!parts) throw new Error(`Invalid spreadsheet date in ${field}.`);
  // Excel dates describe wall-clock components and have no time zone. Format
  // those components without passing through the browser's local time zone.
  const instant = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.H, parts.M, parts.S, Math.round((parts.u || 0) * 1000)));
  const text = instant.toISOString();
  return field === 'attendance_date_with_time'
    ? text.slice(0, -1).replace(/\.000$/, '')
    : text.slice(0, 10);
}

export function parseImportWorkbook(bytes) {
  // Keep numeric Excel serials so a date cell's wall-clock time cannot shift
  // with the computer's time zone. CSV timestamps remain literal input text.
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: '' })[0] || [];
  const date1904 = !!workbook.Workbook?.WBProps?.date1904;
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }).map((row) => Object.fromEntries(Object.entries(row).map(([originalKey, value]) => {
    const field = originalKey.trim();
    const column = headers.findIndex((header) => String(header) === originalKey) + range.s.c;
    const cell = column >= range.s.c ? sheet[XLSX.utils.encode_cell({ r: row.__rowNum__, c: column })] : null;
    const isDate = field === 'attendance_date_with_time' || dateFields.has(field.toLowerCase()) || XLSX.SSF.is_date(cell?.z || '');
    // sheet_to_json may expose formatted date cells as Date objects even with
    // raw:true. Use the underlying numeric cell value as the authority.
    const rawValue = cell?.v ?? value;
    return [field, typeof rawValue === 'number' && isDate ? spreadsheetDate(rawValue, field, date1904) : rawValue];
  })));
}

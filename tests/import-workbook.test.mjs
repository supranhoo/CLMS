import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as XLSX from 'xlsx';
import { parseImportWorkbook } from '../src/utils/importWorkbook.js';

const serial = (year, month, day, hour = 0, minute = 0, second = 0) => (Date.UTC(year, month - 1, day, hour, minute, second) - Date.UTC(1899, 11, 30)) / 86400000;
function serializedWorkbook({ date1904 = false } = {}) {
  const workbook = XLSX.utils.book_new();
  const offset = date1904 ? 1462 : 0;
  const sheet = XLSX.utils.aoa_to_sheet([
    ['employee_code', 'attendance_date_with_time', 'doj', 'amount'],
    ['00012', serial(2026, 10, 16, 8, 15, 30) - offset, serial(2026, 9, 1) - offset, 1250.5],
    ['00013', serial(2026, 10, 17, 0, 5, 59) - offset, serial(2026, 9, 2) - offset, 0],
  ]);
  for (const row of [2, 3]) { sheet[`B${row}`].z = 'yyyy-mm-dd hh:mm:ss'; sheet[`C${row}`].z = 'yyyy-mm-dd'; }
  workbook.Workbook = { WBProps: { date1904 } };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

test('serialized XLSX retains full punch timestamps and date-only employee dates in UTC and India time zones', () => {
  const bytes = serializedWorkbook();
  const expected = [
    { employee_code: '00012', attendance_date_with_time: '2026-10-16T08:15:30', doj: '2026-09-01', amount: 1250.5 },
    { employee_code: '00013', attendance_date_with_time: '2026-10-17T00:05:59', doj: '2026-09-02', amount: 0 },
  ];
  assert.deepEqual(parseImportWorkbook(bytes), expected);
  const moduleUrl = new URL('../src/utils/importWorkbook.js', import.meta.url).href;
  for (const timezone of ['UTC', 'Asia/Kolkata']) {
    const script = `import { parseImportWorkbook } from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(parseImportWorkbook(Buffer.from(process.argv[1], 'base64'))));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, bytes.toString('base64')], { encoding: 'utf8', env: { ...process.env, TZ: timezone } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected, timezone);
  }
});

test('1904 Excel date system preserves the same punch wall-clock value and CSV text is not truncated', () => {
  assert.equal(parseImportWorkbook(serializedWorkbook({ date1904: true }))[0].attendance_date_with_time, '2026-10-16T08:15:30');
  const csv = new TextEncoder().encode('employee_code,attendance_date_with_time\nDEMO001,2026-10-16 08:15:30\n');
  assert.deepEqual(parseImportWorkbook(csv), [{ employee_code: 'DEMO001', attendance_date_with_time: '2026-10-16 08:15:30' }]);
});

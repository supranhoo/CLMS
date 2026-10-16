import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildExportWorkbook, LOCAL_DATA_NOTICE } from '../src/utils/exportWorkbook.js';

test('exports only declared columns, retains text identifiers and records filter provenance', () => {
  const workbook = buildExportWorkbook({
    title: 'Leave ledger',
    columns: [{ key: 'employee_code', label: 'Employee Code' }, { key: 'leave_days', label: 'Leave Days' }, { key: 'remarks', label: 'Remarks' }],
    rows: [{ employee_code: '00012', leave_days: 1.5, remarks: '=HYPERLINK("bad")', selected: true, token: 'must not export' }],
    metadata: { 'Process month': '2026-09', 'Search': '00012' },
    generatedAt: new Date('2026-10-16T04:00:00Z'),
  });
  const reopened = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  assert.deepEqual(reopened.SheetNames, ['Data', 'Metadata']);
  assert.deepEqual(XLSX.utils.sheet_to_json(reopened.Sheets.Data, { header: 1 }), [
    ['Employee Code', 'Leave Days', 'Remarks'], ['00012', 1.5, '=HYPERLINK("bad")'],
  ]);
  assert.equal(reopened.Sheets.Data.C2.t, 's');
  assert.equal(reopened.Sheets.Data.C2.f, undefined);
  const metadata = Object.fromEntries(XLSX.utils.sheet_to_json(reopened.Sheets.Metadata, { header: 1 }).slice(1));
  assert.equal(metadata.Environment, LOCAL_DATA_NOTICE);
  assert.equal(metadata['Generated at (UTC)'], '2026-10-16T04:00:00.000Z');
  assert.equal(metadata['Process month'], '2026-09');
  assert.equal(metadata['Record count'], 1);
});

test('rejects empty records and incomplete column mappings rather than downloading a misleading workbook', () => {
  assert.throws(() => buildExportWorkbook({ columns: [{ key: 'code', label: 'Code' }], rows: [] }), /no displayed records/);
  assert.throws(() => buildExportWorkbook({ columns: [{ key: 'code' }], rows: [{ code: 1 }] }), /key and label/);
});

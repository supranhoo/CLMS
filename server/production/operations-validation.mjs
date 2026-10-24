import { problem } from './security.mjs';

export function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw problem(400, 'Use a valid calendar date (YYYY-MM-DD).');
  return value;
}
export function range(body) {
  const from = day(body.from_date); const to = day(body.to_date);
  if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 92) throw problem(400, 'Use an ordered range of at most 93 days.');
  return { from, to };
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw problem(400, 'Use an identifier of 1–80 letters, numbers, underscores or hyphens.');
  return value;
}
export function reason(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) throw problem(400, 'A reason of 1–500 characters is required.');
  return value.trim();
}
export function stamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw problem(400, 'Punches need an ISO timestamp with seconds and timezone offset.');
  day(value.slice(0, 10));
  if (/[+-]14:(?!00)/.test(value) || new Date(value).getUTCFullYear() < 1 || new Date(value).getUTCFullYear() > 9999) throw problem(400, 'Timestamp offset or year is out of range.');
  return new Date(value);
}
export function chargedDays(value) {
  if (!Array.isArray(value) || !value.length || value.length > 93) throw problem(400, 'Provide 1–93 explicitly charged dates.');
  const dates = value.map(row => { if (typeof row?.units !== 'number') throw problem(400, 'Leave units must be numeric.'); return { date: day(row?.date), units: row.units }; }).sort((a, b) => a.date.localeCompare(b.date));
  if (dates.some(row => ![0.25, 0.5, 0.75, 1].includes(row.units)) || new Set(dates.map(row => row.date)).size !== dates.length) throw problem(400, 'Dates must be unique, with 0.25–1 leave units in quarter-day steps.');
  range({ from_date: dates[0].date, to_date: dates.at(-1).date });
  return dates;
}
export function page(body = {}) {
  const limit = Number(body.limit ?? 100); const offset = Number(body.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(offset) || offset < 0 || offset > 10000000) throw problem(400, 'Invalid page offset or limit (maximum 500).');
  return { limit, offset };
}
export function expectedVersion(value) {
  if (!Number.isInteger(value) || value < 1) throw problem(409, 'Reload to obtain the current record version.');
  return value;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { day, range, stamp, chargedDays, page } from '../server/production/operations-validation.mjs';
import { canApprove, validateAssignments } from '../server/production/security.mjs';

test('operation dates reject calendar rollover, ambiguous timestamps and excessive ranges', () => {
  for (const invalid of ['2026-02-30','0000-01-01','2026-13-01','2026-01-01T00:00:00Z']) assert.throws(() => day(invalid), /calendar/);
  assert.equal(day('2028-02-29'), '2028-02-29');
  assert.throws(() => range({ from_date: '2026-01-01', to_date: '2026-12-31' }), /93 days/);
  assert.throws(() => stamp('2026-10-05T08:00:00'), /timezone/);
  assert.throws(() => stamp('2026-10-05T08:00:00+14:30'), /offset/);
  assert.equal(stamp('2026-10-05T22:00:00+05:30').toISOString(), '2026-10-05T16:30:00.000Z');
});
test('leave charged dates are explicit, unique, bounded and numeric', () => {
  const days = chargedDays([{ date: '2026-10-06', units: 0.5 }, { date: '2026-10-05', units: 1 }]);
  assert.equal(days[0].date, '2026-10-05');
  assert.throws(() => chargedDays([{ date: '2026-10-05', units: true }]), /numeric/);
  assert.throws(() => chargedDays([{ date: '2026-10-05', units: 0.3 }]), /quarter-day/);
  assert.throws(() => chargedDays([{ date: '2026-10-05', units: 0.5 }, { date: '2026-10-05', units: 0.5 }]), /unique/);
});
test('approvals are distinct from write access and cannot be granted to auditors', () => {
  const assignments = validateAssignments({ read: ['attendance','leave'], write: ['attendance'], approve: ['leave'] });
  assert.equal(canApprove({ role: 'OPERATOR', assignments }, 'attendance'), false);
  assert.equal(canApprove({ role: 'OPERATOR', assignments }, 'leave'), true);
  assert.equal(canApprove({ role: 'AUDITOR', assignments }, 'leave'), false);
  assert.throws(() => validateAssignments({ approve: ['workers'] }), /approval module/);
  assert.throws(() => page({ limit: 501 }), /maximum 500/);
});

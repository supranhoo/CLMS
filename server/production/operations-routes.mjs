export function registerOperationsRoutes(register, repository) {
  register(['POST'], '/api/server/attendance/punches', ({ body, user, correlation }) => repository.importPunches(body, user, correlation), { module: 'attendance', write: true });
  register(['POST'], '/api/server/attendance/jobs', ({ body, user, correlation }) => repository.queueAttendance(body, user, correlation), { module: 'attendance', write: true });
  register(['GET'], '/api/server/attendance/jobs', ({ user }) => repository.listJobs(user), { module: 'attendance' });
  register(['GET'], '/api/server/attendance/report', ({ body, user }) => repository.operationalList('attendance', body, user), { module: 'attendance' });
  register(['GET'], '/api/server/attendance/requests', ({ body, user }) => repository.operationalList('attendanceRequests', body, user), { module: 'attendance' });
  register(['POST'], '/api/server/attendance/requests', ({ body, user, correlation }) => repository.requestAttendance(body, user, correlation), { module: 'attendance', write: true });
  register(['POST'], '/api/server/attendance/requests/:id/review', ({ params, body, user, correlation }) => repository.reviewAttendance(params.id, body, user, correlation), { module: 'attendance', approve: true });
  register(['GET'], '/api/server/leave/types', () => repository.leaveTypes(), { module: 'leave' });
  register(['PUT'], '/api/server/leave/types', ({ body, user, correlation }) => repository.saveLeaveType(body, user, correlation), { admin: true });
  register(['POST'], '/api/server/leave/credits', ({ body, user, correlation }) => repository.creditLeave(body, user, correlation), { admin: true });
  register(['GET'], '/api/server/leave/balances', ({ body, user }) => repository.balances(body, user), { module: 'leave' });
  register(['GET'], '/api/server/leave/ledger', ({ body, user }) => repository.operationalList('ledger', body, user), { module: 'leave' });
  register(['GET'], '/api/server/leave/requests', ({ body, user }) => repository.operationalList('leaveRequests', body, user), { module: 'leave' });
  register(['POST'], '/api/server/leave/requests', ({ body, user, correlation }) => repository.requestLeave(body, user, correlation), { module: 'leave', write: true });
  register(['POST'], '/api/server/leave/requests/:id/review', ({ params, body, user, correlation }) => repository.reviewLeave(params.id, body, user, correlation), { module: 'leave', approve: true });
  register(['GET'], '/api/server/period-locks', () => repository.listLocks(), { admin: true });
  register(['PUT'], '/api/server/period-locks', ({ body, user, correlation }) => repository.setPeriodLock(body, user, correlation), { admin: true });
}

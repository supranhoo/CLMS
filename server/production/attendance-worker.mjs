export function startAttendanceWorker(repository, { intervalMs = 1000, log = () => console.error('Attendance worker could not access the queue; it will retry.') } = {}) {
  let pending = null; let stopping = false;
  const tick = () => {
    if (stopping || pending) return;
    pending = (async () => { const job = await repository.claimAttendanceJob(); if (job) await repository.processAttendanceJob(job); })().catch(log).finally(() => { pending = null; });
  };
  const timer = setInterval(tick, intervalMs); timer.unref(); tick();
  return async () => { stopping = true; clearInterval(timer); await pending; };
}

import { AsyncLocalStorage } from 'node:async_hooks';

// The signed-in account for the request being handled, so audit fields (created_by, modified_by, approved_by ...)
// record who acted instead of a hard-coded 'demo'. Outside a request (module unit tests, fixtures) it falls back to 'demo'.
const store = new AsyncLocalStorage();

export const runAsActor = (user, work) => store.run(user, work);
export const actorId = () => store.getStore()?.emp_id || 'demo';

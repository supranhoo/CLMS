import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectDatabase, migrate, verifySchema } from '../server/production/database.mjs';
import { SqlRepository } from '../server/production/repository.mjs';
import { hashPassword, digest } from '../server/production/security.mjs';
import { createProductionServer } from '../server/production/http.mjs';
import http from 'node:http';
import { operationalScenarios } from '../testing/sql-operations-scenarios.mjs';

test('SQL migrations, bootstrap, durable sessions, audited transactions and concurrent updates', { skip: !process.env.CLMS_TEST_DATABASE_CONNECTION }, async context => {
  const connection = process.env.CLMS_TEST_DATABASE_CONNECTION;
  if (!/Database=clms_test_[a-f0-9]+;/i.test(connection)) throw new Error('Integration tests require a dedicated clms_test_<hex> database.');
  const pool = await connectDatabase({ databaseUrl: connection, trustServerCertificate: true });
  const correlation = randomUUID();
  try {
    await migrate(pool); await migrate(pool); await verifySchema(pool);
    const repo = new SqlRepository(pool);
    const passwordHash = await hashPassword('TestPassword-123456');
    await repo.bootstrap({ emp_id: 'test_admin', Name: 'Fictional test administrator', passwordHash }, correlation);
    await assert.rejects(repo.bootstrap({ emp_id: 'second_admin', Name: 'Fictional', passwordHash }, correlation), /Bootstrap is disabled/);
    let admin = await repo.findUser('test_admin'); assert.equal(admin.role, 'ADMIN');
    await repo.changePassword('test_admin', passwordHash, await hashPassword('Replacement-Password-123'), correlation);
    admin = await repo.findUser('test_admin'); assert.equal(admin.mustChangePassword, false);
    const tokenHash = digest('Fictional random session token for database tests');
    assert.equal(await repo.login(admin.emp_id, admin.passwordHash, tokenHash, 3600, correlation), true);
    assert.equal((await new SqlRepository(pool).getSession(tokenHash, 1800)).emp_id, admin.emp_id);
    await repo.createUser({ emp_id: 'test_operator', Name: 'Fictional operator', role: 'OPERATOR', passwordHash, assignments: {}, mustChangePassword: false }, admin, correlation);
    const operatorHash = digest('Separate test operator session');
    await repo.login('test_operator', passwordHash, operatorHash, 3600, correlation);
    await repo.resetPassword('test_operator', await hashPassword('Temporary-Replacement-123'), 1, admin, correlation);
    assert.equal(await repo.getSession(operatorHash, 1800), null);
    const resetUser = await repo.findUser('test_operator');
    assert.equal(resetUser.mustChangePassword, true);
    await repo.login('test_operator', resetUser.passwordHash, operatorHash, 3600, correlation);
    await repo.updateUser('test_operator', { ...resetUser, Is_Active: 'N', assignments: {} }, admin, correlation);
    assert.equal(await repo.getSession(operatorHash, 1800), null);
    const api = createProductionServer({ repository: repo, config: { mode: 'staging', apiAdapter: 'sql', publicOrigin: 'https://clms.test', sessionSeconds: 3600, idleSeconds: 1800 } });
    await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
    const request = (path, method = 'GET', body, cookie, csrf) => new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: api.address().port, path, method, headers: { Host: 'clms.test', Origin: 'https://clms.test', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } }, res => {
        let data = ''; res.setEncoding('utf8'); res.on('data', value => { data += value; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data), cookie: res.headers['set-cookie']?.[0]?.split(';')[0] }));
      }); req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
    });
    try {
      const auth = await request('/api/users/login', 'POST', { emp_id: admin.emp_id, password: 'Replacement-Password-123' });
      assert.equal(auth.status, 200); assert.ok(auth.cookie);
      assert.equal((await request('/api/users/session', 'GET', undefined, auth.cookie)).body.emp_id, admin.emp_id);
      assert.equal((await request('/api/users/logout', 'POST', {}, auth.cookie, auth.body.csrfToken)).status, 200);
      assert.equal((await request('/api/users/session', 'GET', undefined, auth.cookie)).status, 401);
    } finally { await new Promise(resolve => api.close(resolve)); }
    await repo.saveRecord('contractor', { Contractor_ID: 'T1', Contractor_Name: 'Fictional contractor' }, null, admin, correlation);
    await repo.saveRecord('worker', { Employee_Code: 'TEST001', display_name: 'Fictional worker', contractor_id: 'T1', dept: 'D1', bu: 'B1', loc_code: 'L1' }, null, admin, correlation);
    await assert.rejects(repo.saveRecord('worker', { Employee_Code: 'MISSING', display_name: 'Missing contractor', contractor_id: 'NOPE' }, null, admin, correlation), /referenced record/);
    assert.equal((await repo.list('worker', admin)).length, 1);
    assert.equal((await repo.list('worker', admin, { limit: 1, offset: 1 })).length, 0);
    assert.equal((await repo.list('worker', admin, { employeeCode: 'MISSING' })).length, 0);
    assert.equal((await repo.list('worker', admin, { search: 'Fictional' })).length, 1);
    await assert.rejects(repo.list('worker', admin, { limit: 501 }), /limit/);
    const operator = { emp_id: 'operator', role: 'OPERATOR', assignments: { contractors: ['T1'], departments: ['D1'], businessUnits: ['B1'], locations: ['L1'] } };
    assert.equal((await repo.list('worker', operator)).length, 1);
    assert.equal((await repo.list('worker', { ...operator, assignments: {} })).length, 0);
    await assert.rejects(repo.saveRecord('worker', { Employee_Code: 'TEST001', display_name: 'Attempt to move scope', contractor_id: 'T1', dept: 'OTHER', bu: 'B1', loc_code: 'L1' }, 1, operator, correlation), /outside your assigned scope/);
    const before = (await repo.list('worker', admin))[0];
    const edits = await Promise.allSettled([
      repo.saveRecord('worker', { ...before, display_name: 'First edit' }, before.version, admin, correlation),
      repo.saveRecord('worker', { ...before, display_name: 'Second edit' }, before.version, admin, correlation),
    ]);
    assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await repo.list('worker', admin))[0].version, 2);
    await repo.saveMaster('locations', ['loc_code'], 'POST', { loc_code: 'L1', loc_name: 'Test location' }, admin, correlation);
    const master = (await repo.listMasters('locations'))[0];
    await assert.rejects(repo.saveMaster('locations', ['loc_code'], 'PUT', { keys: { loc_code: 'L1' }, data: { loc_code: 'L1', loc_name: 'Bad version' }, version: 999 }, admin, correlation), /Record changed|record changed/);
    assert.equal((await repo.listMasters('locations'))[0].loc_name, 'Test location');
    await repo.saveMaster('locations', ['loc_code'], 'PUT', { keys: { loc_code: 'L1' }, data: { loc_code: 'L1', loc_name: 'Updated' }, version: master.version }, admin, correlation);
    const audit = await repo.listAudit();
    assert.ok(audit.some(row => row.action === 'WORKER_CREATED'));
    assert.ok(!audit.some(row => row.target === 'MISSING'));
    await assert.rejects(repo.updateUser(admin.emp_id, { ...admin, role: 'OPERATOR', assignments: {} }, admin, correlation), /final active administrator/);
    await repo.logout(tokenHash, admin, correlation);
    assert.equal(await repo.getSession(tokenHash, 1800), null);
    for (let n = 0; n < 5; n++) await repo.failedLogin(admin.emp_id);
    assert.ok((await repo.findUser(admin.emp_id)).lockedUntil > new Date());
    assert.equal(await repo.login(admin.emp_id, admin.passwordHash, digest('locked'), 3600, correlation), false);
    await context.test('SQL attendance jobs, approvals, leave ledger, reversals, balance invariants and locks', async () => operationalScenarios(pool));
  } finally { await pool.close(); }
});

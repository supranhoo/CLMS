import test from 'node:test';
import assert from 'node:assert/strict';
import { readServerConfig } from '../server/config.mjs';

test('server config defaults to loopback synthetic demo mode', () => {
  const config = readServerConfig({});
  assert.equal(config.mode, 'demo');
  assert.equal(config.apiAdapter, 'synthetic');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 5001);
  assert.equal(config.isDemo, true);
});

test('server mode requires a real adapter and database URL', () => {
  assert.throws(() => readServerConfig({ CLMS_MODE: 'production', CLMS_API_ADAPTER: 'synthetic' }), /synthetic adapter/);
  assert.throws(() => readServerConfig({ CLMS_MODE: 'production', CLMS_API_ADAPTER: 'sql' }), /CLMS_DATABASE_URL/);
  const config = readServerConfig({ CLMS_MODE: 'staging', CLMS_API_ADAPTER: 'sql', CLMS_DATABASE_URL: 'Server=localhost;Database=clms_test', PUBLIC_ORIGIN: 'https://clms.test' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.isDemo, false);
});

test('demo-only reset cannot be enabled in server modes', () => {
  assert.throws(() => readServerConfig({ CLMS_MODE: 'production', CLMS_API_ADAPTER: 'sql', CLMS_DATABASE_URL: 'sqlserver://staging', CLMS_ALLOW_DEMO_RESET: 'true' }), /DEMO_RESET/);
});

test('server settings reject insecure origin, insecure SQL certificates and unsafe demo bindings', () => {
  const server = { CLMS_MODE: 'staging', CLMS_DATABASE_URL: 'Server=localhost;Database=clms_test', PUBLIC_ORIGIN: 'https://clms.test' };
  for (const origin of ['http://clms.test', 'https://clms.test/path', 'https://user:secret@clms.test', 'https://clms.test/']) assert.throws(() => readServerConfig({ ...server, PUBLIC_ORIGIN: origin }), /PUBLIC_ORIGIN/);
  assert.throws(() => readServerConfig({ ...server, CLMS_MODE: 'production', CLMS_SQL_TRUST_CERTIFICATE: 'true' }), /trusted SQL/);
  assert.throws(() => readServerConfig({ CLMS_BIND_HOST: '0.0.0.0' }), /loopback/);
  assert.throws(() => readServerConfig({ ...server, CLMS_SESSION_IDLE_SECONDS: '99999' }), /lifetimes/);
});

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
  const config = readServerConfig({ CLMS_MODE: 'staging', CLMS_API_ADAPTER: 'sql', CLMS_DATABASE_URL: 'sqlserver://staging' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.isDemo, false);
});

test('demo-only reset cannot be enabled in server modes', () => {
  assert.throws(() => readServerConfig({ CLMS_MODE: 'production', CLMS_API_ADAPTER: 'sql', CLMS_DATABASE_URL: 'sqlserver://staging', CLMS_ALLOW_DEMO_RESET: 'true' }), /DEMO_RESET/);
});

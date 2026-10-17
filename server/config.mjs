import { resolve } from 'node:path';

const truthy = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export function readServerConfig(env = process.env) {
  const mode = String(env.CLMS_MODE || env.APP_MODE || 'demo').trim().toLowerCase();
  if (!['demo', 'staging', 'production'].includes(mode)) {
    throw new Error(`CLMS_MODE must be demo, staging, or production (received: ${mode || 'empty'}).`);
  }
  const isDemo = mode === 'demo';
  const host = String(env.CLMS_BIND_HOST || (isDemo ? '127.0.0.1' : '0.0.0.0')).trim();
  const port = Number(env.CLMS_API_PORT || 5001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CLMS_API_PORT must be a valid TCP port.');
  const dataDir = resolve(String(env.CLMS_DATA_DIR || './.local-demo'));
  const apiAdapter = String(env.CLMS_API_ADAPTER || (isDemo ? 'synthetic' : 'sql')).trim().toLowerCase();
  if (!['synthetic', 'sql', 'original-api'].includes(apiAdapter)) {
    throw new Error('CLMS_API_ADAPTER must be synthetic, sql, or original-api.');
  }
  if (!isDemo && apiAdapter === 'synthetic') {
    throw new Error('The synthetic adapter is only allowed in demo mode. Configure sql or original-api for server modes.');
  }
  if (!isDemo && !env.CLMS_DATABASE_URL && apiAdapter === 'sql') {
    throw new Error('CLMS_DATABASE_URL is required when CLMS_API_ADAPTER=sql.');
  }
  if (!isDemo && truthy(env.CLMS_ALLOW_DEMO_RESET)) {
    throw new Error('CLMS_ALLOW_DEMO_RESET cannot be enabled outside demo mode.');
  }
  return {
    mode,
    isDemo,
    host,
    port,
    dataDir,
    persist: env.CLMS_PERSIST !== undefined ? truthy(env.CLMS_PERSIST) : true,
    apiAdapter,
    publicOrigin: String(env.PUBLIC_ORIGIN || '').trim(),
    databaseUrl: String(env.CLMS_DATABASE_URL || '').trim(),
    allowDemoReset: isDemo && truthy(env.CLMS_ALLOW_DEMO_RESET),
  };
}


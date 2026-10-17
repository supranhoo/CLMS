import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const truthy = value => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export function readServerConfig(env = process.env) {
  const mode = String(env.CLMS_MODE || env.APP_MODE || 'demo').trim().toLowerCase();
  if (!['demo', 'staging', 'production'].includes(mode)) {
    throw new Error(`CLMS_MODE must be demo, staging, or production (received: ${mode || 'empty'}).`);
  }
  const isDemo = mode === 'demo';
  const host = String(env.CLMS_BIND_HOST || (isDemo ? '127.0.0.1' : '0.0.0.0')).trim();
  if (isDemo && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Demo mode must bind to loopback.');
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
  const databaseUrl = env.CLMS_DATABASE_URL_FILE ? readFileSync(env.CLMS_DATABASE_URL_FILE, 'utf8').trim() : String(env.CLMS_DATABASE_URL || '').trim();
  if (!isDemo && !databaseUrl && apiAdapter === 'sql') {
    throw new Error('CLMS_DATABASE_URL or CLMS_DATABASE_URL_FILE is required when CLMS_API_ADAPTER=sql.');
  }
  if (!isDemo && truthy(env.CLMS_ALLOW_DEMO_RESET)) {
    throw new Error('CLMS_ALLOW_DEMO_RESET cannot be enabled outside demo mode.');
  }
  const publicOrigin = String(env.PUBLIC_ORIGIN || '').trim();
  if (!isDemo) {
    let origin;
    try { origin = new URL(publicOrigin); } catch { throw new Error('PUBLIC_ORIGIN must be a canonical HTTPS origin.'); }
    if (origin.protocol !== 'https:' || origin.origin !== publicOrigin || origin.username || origin.password) throw new Error('PUBLIC_ORIGIN must be a canonical HTTPS origin without credentials, a path or a trailing slash.');
  }
  const idleSeconds = Number(env.CLMS_SESSION_IDLE_SECONDS || 1800);
  const sessionSeconds = Number(env.CLMS_SESSION_MAX_SECONDS || 43200);
  if (![idleSeconds, sessionSeconds].every(value => Number.isInteger(value) && value >= 60 && value <= 86400) || idleSeconds > sessionSeconds) throw new Error('Session lifetimes must be 60–86400 seconds, with idle timeout no greater than maximum lifetime.');
  const trustServerCertificate = truthy(env.CLMS_SQL_TRUST_CERTIFICATE);
  if (mode === 'production' && trustServerCertificate) throw new Error('Production requires a trusted SQL Server certificate.');
  return {
    mode,
    isDemo,
    host,
    port,
    dataDir,
    persist: env.CLMS_PERSIST !== undefined ? truthy(env.CLMS_PERSIST) : true,
    apiAdapter,
    publicOrigin,
    databaseUrl,
    idleSeconds,
    sessionSeconds,
    trustServerCertificate,
    allowDemoReset: isDemo && truthy(env.CLMS_ALLOW_DEMO_RESET),
  };
}


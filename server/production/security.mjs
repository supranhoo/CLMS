import { randomBytes, scrypt as callbackScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(callbackScrypt);
export function problem(status, message) { return Object.assign(new Error(message), { status }); }
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw problem(400, 'Use 12–128 characters including letters and numbers.');
  }
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(24).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:32768:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  const [algorithm, cost, salt, hex] = encoded.split(':');
  if (algorithm !== 'scrypt' || cost !== '32768' || !/^[a-f0-9]{48}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const csrfFor = token => digest(`csrf:${token}`);
export const publicUser = user => ({ emp_id: user.emp_id, Name: user.Name, email_id: user.email_id || '', role: user.role, Is_Active: user.Is_Active, mustChangePassword: Boolean(user.mustChangePassword) });
export const cookieName = '__Host-clms-session';
export function sessionCookie(token, maxAge) {
  return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}
export function readSessionCookie(header = '') {
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${cookieName}=`));
  if (values.length !== 1) return '';
  const value = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
export const ROLES = ['ADMIN', 'OPERATOR', 'AUDITOR'];
const modules = ['workers', 'contractors', 'masters'];
export function validateAssignments(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem(400, 'Assignments must be an object.');
  const result = {};
  for (const key of ['contractors', 'departments', 'businessUnits', 'locations', 'read', 'write']) {
    const items = value[key] ?? [];
    if (!Array.isArray(items) || items.length > 500 || items.some(item => typeof item !== 'string' || !item.trim() || item.length > 80)) throw problem(400, `Invalid ${key} assignment.`);
    result[key] = [...new Set(items)];
  }
  if ([...result.read, ...result.write].some(item => !modules.includes(item))) throw problem(400, 'Unknown permission module.');
  return result;
}
export function canAccess(user, module, write = false) {
  return user.role === 'ADMIN' || (!write || user.role !== 'AUDITOR') && (user.assignments?.[write ? 'write' : 'read'] || []).includes(module);
}
export function inScope(user, record, kind) {
  if (user.role === 'ADMIN') return true;
  const assignments = user.assignments || {};
  const contractor = kind === 'contractor' ? record.Contractor_ID : record.contractor_id;
  if (!(assignments.contractors || []).includes(String(contractor || ''))) return false;
  if (kind === 'contractor') return true;
  return [['departments', 'dept'], ['businessUnits', 'bu'], ['locations', 'loc_code']].every(([key, field]) => (assignments[key] || []).includes(String(record[field] || '')));
}

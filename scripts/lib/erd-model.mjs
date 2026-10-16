// Joins the catalogue to real data: resolves each entity's rows, observes its columns, and checks every reference.
import { referenceData, MENUS } from '../../server/seed.mjs';
import { ENTITIES, RELATIONSHIPS, STATE_META_KEYS } from './erd-catalogue.mjs';

const present = value => value !== undefined && value !== null && String(value).trim() !== '';
const at = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);

/** The server's built-in lists (they are entities of the model but are not stored in the state file). */
export async function builtInLists(call, state) {
  const get = async p => (await call(p, {})).data;
  const reference = referenceData(state);
  return {
    entities: await get('/api/entity'),
    departments: await get('/api/entity/getAllDept'),
    leaveTypes: await get('/api/leave/getLeaveTypes'),
    transTypes: await get('/api/leave/getTransTypes'),
    designations: reference.alldesignation, sections: reference.section, employeeTypes: reference.emptype,
    employeeCategories: reference.empcategory, banks: reference.bankmast, states: reference.statemast,
    menus: MENUS,
  };
}

export const rowsOf = (entity, ctx) => {
  if (entity.rows) return entity.rows(ctx) || [];
  const value = entity.stateKey ? at(ctx.state, entity.stateKey) : undefined;
  return Array.isArray(value) ? value : [];
};

// Examples must be stable between runs, so values the server generates (clock stamps, random ids) are described, not shown.
const exampleOf = value => {
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text) && typeof value === 'string') return '(server clock, ISO date-time)';
  if (/^[0-9a-f]{16,}$/.test(text)) return '(random hex)';
  return text.slice(0, 28);
};
const typeOf = value => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);

/** Column inventory of a set of records: every field seen, its types, how often it is filled, one example. */
export function observeColumns(rows, secret = []) {
  const columns = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const [field, value] of Object.entries(row)) {
      const column = columns.get(field) || { field, types: new Set(), filled: 0, rows: 0, example: undefined };
      column.types.add(typeOf(value)); column.rows++;
      if (present(value)) column.filled++;
      if (column.example === undefined && present(value) && typeof value !== 'object') column.example = secret.includes(field) ? '(secret, not shown)' : exampleOf(value);
      columns.set(field, column);
    }
  }
  return [...columns.values()].map(c => ({ ...c, types: [...c.types].filter(t => t !== 'null'), nullable: c.types.has('null') || c.filled < c.rows }));
}

/** Check every catalogue reference against the data. Returns one result per relationship. */
export function checkIntegrity(ctx) {
  const byId = new Map(ENTITIES.map(e => [e.id, e]));
  const index = new Map(); // entity id -> Set of normalised key tuples, built per field-list on demand
  const keyset = (entityId, fields) => {
    const cacheKey = entityId + '|' + fields.join(',');
    if (!index.has(cacheKey)) {
      const entity = byId.get(entityId);
      index.set(cacheKey, new Set(rowsOf(entity, ctx).map(row => fields.map(f => (entity.normalise?.[f] || String)(row[f])).join('\u0001'))));
    }
    return index.get(cacheKey);
  };
  return RELATIONSHIPS.map(rel => {
    const child = byId.get(rel.from); const parentKeys = keyset(rel.to, rel.toFields);
    const norm = f => byId.get(rel.to).normalise?.[rel.toFields[rel.fields.indexOf(f)]] || child.normalise?.[f] || String;
    let checked = 0; const dangling = [];
    for (const row of rowsOf(child, ctx)) {
      if (rel.when && !rel.when(row)) continue;
      const values = rel.fields.map(f => row[f]);
      if (values.every(v => !present(v))) { if (rel.optional || rel.when) continue; }
      if (rel.also && values.length === 1 && rel.also.includes(String(values[0]))) continue;
      checked++;
      const tuple = rel.fields.map((f, i) => norm(f)(values[i])).join('\u0001');
      if (!parentKeys.has(tuple)) dangling.push(rel.fields.map((f, i) => `${f}=${JSON.stringify(values[i])}`).join(', '));
    }
    return { ...rel, checked, dangling: [...new Set(dangling)] };
  });
}

/** State keys no entity accounts for, and catalogue entities whose collection does not exist (reserved ones excepted). */
export function coverage(state) {
  const claimed = new Set(); const missing = [];
  for (const entity of ENTITIES) {
    if (!entity.stateKey) continue;
    const top = entity.stateKey.split('.')[0]; claimed.add(top === 'masters' ? 'masters:' + entity.stateKey.split('.')[1] : top);
    if (!entity.reserved && at(state, entity.stateKey) === undefined) missing.push(entity.id);
  }
  const unclaimed = [];
  for (const key of Object.keys(state)) {
    if (STATE_META_KEYS.includes(key)) continue;
    if (key === 'masters') { for (const master of Object.keys(state.masters)) if (!claimed.has('masters:' + master)) unclaimed.push('masters.' + master); continue; }
    if (!claimed.has(key)) unclaimed.push(key);
  }
  return { unclaimed, missing };
}

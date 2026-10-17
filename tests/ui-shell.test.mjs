import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenMenu, normalizePath, organizeMenu, routeMatches } from '../src/components/layout/navigation.js';

const rows = [
  { menu_id: 1, parent_menu_id: 0, menu_name: 'Masters Module', menu_url: '' },
  { menu_id: 2, parent_menu_id: 1, menu_name: 'Worker Management', menu_url: '/manageEmployees' },
  { menu_id: 3, parent_menu_id: 1, menu_name: 'Contractor Management', menu_url: '/manageContractors' },
  { menu_id: 4, parent_menu_id: 0, menu_name: 'Attendance Module', menu_url: '' },
  { menu_id: 5, parent_menu_id: 4, menu_name: 'Attendance Calendar', menu_url: '/manageAttendance' },
];

test('shell navigation organizes permitted menu rows and preserves destination order', () => {
  const groups = organizeMenu(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].children[0].menu_url, '/manageEmployees');
  assert.deepEqual(flattenMenu(groups).map((item) => item.menu_name), [
    'Worker Management', 'Contractor Management', 'Attendance Calendar',
  ]);
});

test('shell route matching is case-insensitive and supports nested destinations', () => {
  assert.equal(normalizePath('/Dashboard/'), '/dashboard');
  assert.equal(routeMatches('/ManageEmployees/details', '/manageemployees'), true);
  assert.equal(routeMatches('/manageAttendance', '/manageEmployees'), false);
});

test('shell source keeps required navigation and public-shell contracts', async () => {
  const appShell = await (await import('node:fs/promises')).readFile(new URL('../src/components/layout/AppShell.jsx', import.meta.url), 'utf8');
  const shellCss = await (await import('node:fs/promises')).readFile(new URL('../src/components/layout/AppShell.css', import.meta.url), 'utf8');
  const app = await (await import('node:fs/promises')).readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appShell, /Search screens/);
  assert.match(appShell, /aria-expanded/);
  assert.match(appShell, /Escape/);
  assert.match(shellCss, /@media \(max-width: 1000px\)/);
  assert.match(shellCss, /\.bfcl-drawer-backdrop/);
  assert.match(app, /PublicShell/);
  assert.match(app, /path="\/dashboard"/);
});

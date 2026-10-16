import test from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorMessage } from '../src/utils/apiError.js';
import { escapeHtml } from '../src/utils/escapeHtml.js';

const failed = (status, data) => ({ response: { status, data } });

test('apiErrorMessage shows the local API message for 4xx and 5xx answers', () => {
  assert.equal(apiErrorMessage(failed(409, { success: false, message: 'Employee code already exists in the local demo.', error: 'LOCAL_DEMO_ERROR' })), 'Employee code already exists in the local demo.');
  assert.equal(apiErrorMessage(failed(403, { error: 'Local administrator access is required.' })), 'Local administrator access is required.');
});

test('apiErrorMessage still reads the legacy SQL Server error shape', () => {
  assert.equal(apiErrorMessage(failed(400, { error: { originalError: { info: { message: 'Violation of UNIQUE KEY' } } } })), 'Violation of UNIQUE KEY');
});

test('apiErrorMessage never throws, whatever the failure looks like', () => {
  assert.match(apiErrorMessage(failed(500, {}), 'Save failed'), /Save failed \(HTTP 500\)/);
  assert.match(apiErrorMessage({ request: {} }), /did not respond/);
  assert.equal(apiErrorMessage(new Error('boom')), 'boom');
  assert.equal(apiErrorMessage(undefined, 'fallback'), 'fallback');
  assert.equal(apiErrorMessage(null), 'The request could not be completed.');
});

test('escapeHtml neutralises markup and tolerates empty values', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml(`O'Neil & Sons`), 'O&#39;Neil &amp; Sons');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalUrl } from '../src/utils/safeUrl.js';

test('safe external links allow absolute HTTP(S) source URLs only', () => {
  assert.equal(safeExternalUrl('https://example.test/task/1'), 'https://example.test/task/1');
  assert.equal(safeExternalUrl('http://example.test/task/1'), 'http://example.test/task/1');
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('//example.test/task/1'), null);
  assert.equal(safeExternalUrl('not a url'), null);
  assert.equal(safeExternalUrl('x'.repeat(2049)), null);
  assert.equal(safeExternalUrl(null), null);
});

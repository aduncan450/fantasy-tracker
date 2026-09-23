import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../js/admin-layout.js',import.meta.url),'utf8');

test('admin layout does not observe descendant mutations that it mutates itself',()=>{
  assert.doesNotMatch(source,/observer\.observe\(app,\s*\{[^}]*subtree\s*:\s*true/);
  assert.match(source,/observer\.observe\(app,\s*\{\s*childList\s*:\s*true\s*\}\)/);
});

test('sync label rewrite is guarded against no-op text mutations',()=>{
  assert.match(source,/if\(sync\.textContent!==syncText\)sync\.textContent=syncText/);
});

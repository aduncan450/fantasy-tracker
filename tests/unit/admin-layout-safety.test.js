import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const layout=read('../../js/admin-layout.js');
const observerDriven=[
  ['admin layout',layout],
  ['admin QoL',read('../../js/admin-qol.js')],
  ['admin bet entry',read('../../js/admin-bet-entry.js')]
];

test('admin DOM enhancers do not watch descendant mutations they also rewrite',()=>{
  for(const [name,source] of observerDriven){
    assert.doesNotMatch(source,/observe\(app,\s*\{[^}]*subtree\s*:\s*true/,`${name} must not observe the full #app subtree`);
  }
});

test('admin layout watches only core top-level rerenders',()=>{
  assert.match(layout,/observer\.observe\(app,\s*\{\s*childList\s*:\s*true\s*\}\)/);
});

test('sync label rewrite is guarded against no-op text mutations',()=>{
  assert.match(layout,/if\(sync\.textContent!==syncText\)sync\.textContent=syncText/);
});

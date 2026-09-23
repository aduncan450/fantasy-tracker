import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const layout=read('../../js/admin-layout.js');
const jsDir=new URL('../../js/',import.meta.url);
const adminScripts=readdirSync(jsDir)
  .filter(name=>name.endsWith('.js')&&(name.includes('admin')||name==='admin.js'))
  .map(name=>[name,read(`../../js/${name}`)]);

test('admin scripts do not observe the full #app subtree',()=>{
  for(const [name,source] of adminScripts){
    assert.doesNotMatch(source,/\.observe\(app,\s*\{[^}]*subtree\s*:\s*true/,`${name} must not observe the full #app subtree`);
  }
});

test('admin layout watches only core top-level rerenders',()=>{
  assert.match(layout,/observer\.observe\(app,\s*\{\s*childList\s*:\s*true\s*\}\)/);
});

test('sync label rewrite is guarded against no-op text mutations',()=>{
  assert.match(layout,/if\(sync\.textContent!==syncText\)sync\.textContent=syncText/);
});

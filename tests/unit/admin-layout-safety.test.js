import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const bootstrap=read('../../js/admin-bootstrap.js');
const layout=read('../../js/admin-layout.js');
const jsDir=new URL('../../js/',import.meta.url);
const adminScripts=readdirSync(jsDir)
  .filter(name=>name.endsWith('.js')&&(name.includes('admin')||name==='admin.js'))
  .map(name=>[name,read(`../../js/${name}`)]);

test('admin companion scripts do not create MutationObservers',()=>{
  for(const [name,source] of adminScripts){
    if(name==='admin-bootstrap.js')continue;
    assert.doesNotMatch(source,/new\s+MutationObserver\b/,`${name} must use the centralized admin render event instead of its own observer`);
  }
});

test('admin bootstrap owns one top-level rerender observer and no subtree observer',()=>{
  assert.equal((bootstrap.match(/new\s+MutationObserver\b/g)||[]).length,1);
  assert.match(bootstrap,/\.observe\(app,\s*\{\s*childList\s*:\s*true\s*\}\)/);
  assert.doesNotMatch(bootstrap,/subtree\s*:\s*true/);
  assert.match(bootstrap,/dispatchEvent\(new Event\(ADMIN_RENDER_EVENT\)\)/);
  assert.match(bootstrap,/mutations\.every\(enhancementOnlyMutation\)/);
});

test('admin enhancement modules subscribe to the centralized render event',()=>{
  for(const name of ['admin-layout.js','admin-qol.js','admin-bet-entry.js','bet-adjustments-admin.js','bet-results-admin.js']){
    const source=read(`../../js/${name}`);
    assert.match(source,/addEventListener\('fantasy-admin-rendered'/,`${name} must subscribe to the centralized render event`);
  }
});

test('sync label rewrite is guarded against no-op text mutations',()=>{
  assert.match(layout,/if\(sync\.textContent!==syncText\)sync\.textContent=syncText/);
});

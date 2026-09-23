import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLeague,validateLeague} from '../../js/schema.js';
import {ledger,pot} from '../../js/calculations.js';

test('season-end gambler settlement is a traceable Week 17 pot adjustment',()=>{
  const d=initialLeague();
  d.adjustments.push({week:17,season:true,kind:'bet-placer-settlement',amountCents:88,reason:'Gambler paid $5 bet stake adjustments'});
  assert.doesNotThrow(()=>validateLeague(d));
  const row=ledger(d).find(x=>x.kind==='bet-placer-settlement');
  assert.deepEqual(row,{week:17,season:true,kind:'bet-placer-settlement',amountCents:88,label:'Gambler paid $5 bet stake adjustments'});
  assert.equal(pot(d),88);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLeague,normalizeLeague,validateLeague} from '../../js/schema.js';

test('normalization rewrites supported legacy parlay picks to compact canonical wording',()=>{
  const data=initialLeague();
  data.weeks[1].bets=[{stakeCents:1000,type:'parlay',description:'$10 parlay',status:'lost',payoutCents:0,legs:[
    {player:'Duncan',pick:'K. Walker III Over 78.5 Rushing Yards',status:'hit'},
    {player:'Jacob',pick:'S. Barkley over 94.5 Rushing Yards',status:'miss'},
    {player:'Matt',pick:'D. Montgomery Over .5 Anytime TD',status:'miss'},
    {player:'Weston',pick:'J. Gibbs Over .5 Anytime TD',status:'hit'}
  ]}];

  normalizeLeague(data);

  assert.deepEqual(data.weeks[1].bets[0].legs.map(leg=>leg.pick),[
    'K. Walker III over 78.5 rush yds',
    'S. Barkley over 94.5 rush yds',
    'D. Montgomery over 0.5 anytime TD',
    'J. Gibbs over 0.5 anytime TD'
  ]);
  assert.doesNotThrow(()=>validateLeague(data));
});

test('normalization leaves unsupported legacy free text untouched',()=>{
  const data=initialLeague();
  data.weeks[0].bets=[{stakeCents:1000,type:'parlay',description:'$10 parlay',status:'placed',payoutCents:0,legs:[
    {player:'Duncan',pick:'Custom commissioner note',status:'pending'}
  ]}];
  normalizeLeague(data);
  assert.equal(data.weeks[0].bets[0].legs[0].pick,'Custom commissioner note');
});

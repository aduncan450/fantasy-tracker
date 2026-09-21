import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLeague,normalizeLeague,validateLeague} from '../../js/schema.js';
import {weekResult,duesRows,duesSummary,ledger,pot,currentWeek,playerStats} from '../../js/calculations.js';

const clone=x=>JSON.parse(JSON.stringify(x));
const league=()=>initialLeague();
const week=(d,n)=>d.weeks.find(w=>w.week===n);
const setScores=(w,scores)=>{w.scores={...scores};return w};

test('initial league has 14 regular weeks, playoff weeks 15-16, and betting-only week 17',()=>{
  const d=league();
  assert.equal(d.weeks.length,17);
  assert.deepEqual(d.weeks.slice(0,14).map(w=>w.type),Array(14).fill('regular'));
  assert.equal(week(d,15).type,'playoff');
  assert.equal(week(d,16).type,'playoff');
  assert.equal(week(d,17).type,'betting');
  assert.doesNotThrow(()=>validateLeague(d));
});

test('weekly dues charge the unique lowest scorer $10 and loser of the other matchup $5',()=>{
  const d=league(),w=week(d,1);
  setScores(w,{Duncan:120,Matt:110,Jacob:100,Weston:130});
  const r=weekResult(w);
  assert.equal(r.complete,true);
  assert.deepEqual(r.dues,[
    {player:'Jacob',amountCents:1000,reason:'lowest score this week'},
    {player:'Matt',amountCents:500,reason:'lost the other matchup'}
  ]);
});

test('week 2 matchup cycle correctly charges Matt $10 and Duncan $5 for the QA score set',()=>{
  const d=league(),w=week(d,2);
  setScores(w,{Duncan:125,Jacob:110,Matt:95,Weston:130});
  assert.deepEqual(weekResult(w).dues.map(x=>[x.player,x.amountCents]),[['Matt',1000],['Duncan',500]]);
});

test('incomplete scores and ties fail closed without dues or week advancement',()=>{
  const d=league(),w=week(d,1);
  setScores(w,{Duncan:100,Matt:90,Jacob:80,Weston:''});
  assert.equal(weekResult(w).complete,false);
  assert.equal(duesRows(d).length,0);
  assert.equal(currentWeek(d),1);

  setScores(w,{Duncan:100,Matt:110,Jacob:90,Weston:90});
  assert.equal(weekResult(w).tie,true);
  assert.equal(duesRows(d).length,0);

  setScores(w,{Duncan:100,Matt:100,Jacob:120,Weston:90});
  assert.equal(weekResult(w).tie,true);
  assert.equal(duesRows(d).length,0);
});

test('live Sleeper-synced scores never create dues until marked final',()=>{
  const d=league(),w=week(d,1);
  setScores(w,{Duncan:120,Matt:110,Jacob:100,Weston:130});
  w.sleeperScoresSyncedAt='2026-09-20T12:00:00.000Z';
  w.scoresFinal=false;
  const live=weekResult(w);
  assert.equal(live.complete,false);
  assert.equal(live.live,true);
  assert.equal(duesRows(d).length,0);

  w.scoresFinal=true;
  assert.equal(weekResult(w).complete,true);
  assert.equal(duesRows(d).length,2);
});

test('paid dues affect the pot, unpaid dues do not, and payment reversal is exact',()=>{
  const d=league(),w=week(d,1);
  setScores(w,{Duncan:120,Matt:110,Jacob:100,Weston:130});
  assert.equal(duesSummary(d).unpaidCents,1500);
  assert.equal(pot(d),0);

  w.payments={'Jacob:1000':true};
  assert.equal(pot(d),1000);
  assert.equal(duesSummary(d).unpaidCents,500);

  w.payments['Matt:500']=true;
  assert.equal(pot(d),1500);

  delete w.payments['Jacob:1000'];
  assert.equal(pot(d),500);

  w.payments['Jacob:1000']=true;
  assert.equal(pot(d),1500);
});

test('bet stakes and payouts use total-return accounting',()=>{
  const d=league(),w=week(d,1);
  setScores(w,{Duncan:120,Matt:110,Jacob:100,Weston:130});
  w.payments={'Jacob:1000':true,'Matt:500':true};
  w.bets=[
    {stakeCents:1000,type:'parlay',description:'$10 parlay',status:'lost',payoutCents:0,legs:[
      {player:'Duncan',pick:'A',status:'hit'},
      {player:'Jacob',pick:'B',status:'hit'},
      {player:'Matt',pick:'C',status:'miss'},
      {player:'Weston',pick:'D',status:'hit'}
    ]},
    {stakeCents:500,type:'single',description:'single',status:'won',payoutCents:1200}
  ];
  assert.equal(pot(d),1200);
  assert.equal(ledger(d).filter(x=>x.kind==='stake').length,2);
  assert.equal(ledger(d).filter(x=>x.kind==='payout').reduce((s,x)=>s+x.amountCents,0),1200);
});

test('historical score correction invalidates stale payment flags instead of transferring money',()=>{
  const d=league(),w=week(d,2);
  setScores(w,{Duncan:125,Jacob:110,Matt:95,Weston:130});
  w.payments={'Matt:1000':true,'Duncan:500':true};
  assert.equal(pot(d),1500);

  setScores(w,{Duncan:90,Jacob:110,Matt:125,Weston:130});
  assert.deepEqual(weekResult(w).dues.map(x=>[x.player,x.amountCents]),[['Duncan',1000],['Jacob',500]]);
  assert.equal(pot(d),0);
  assert.ok(duesRows(d).every(x=>x.paid===false));
});

test('parlay player stats count only decided hit/miss legs',()=>{
  const d=league(),w=week(d,1);
  w.bets=[{stakeCents:1000,type:'parlay',description:'$10 parlay',status:'placed',payoutCents:0,legs:[
    {player:'Duncan',pick:'A',status:'hit'},
    {player:'Jacob',pick:'B',status:'pending'},
    {player:'Matt',pick:'C',status:'miss'},
    {player:'Weston',pick:'D',status:'push'}
  ]}];
  const byPlayer=Object.fromEntries(playerStats(d).map(x=>[x.player,x.parlay]));
  assert.deepEqual(byPlayer.Duncan,{player:'Duncan',hits:1,total:1,pct:100});
  assert.deepEqual(byPlayer.Matt,{player:'Matt',hits:0,total:1,pct:0});
  assert.equal(byPlayer.Jacob.total,0);
  assert.equal(byPlayer.Weston.total,0);
});

test('Week 17 participates in bet accounting but cannot contain fantasy-week state',()=>{
  const d=league(),w=week(d,17);
  d.season.startingPotCents=2000;
  w.bets=[{stakeCents:500,type:'single',description:'final bet',status:'won',payoutCents:900}];
  assert.equal(pot(d),2400);
  assert.doesNotThrow(()=>validateLeague(d));

  const bad=clone(d);
  week(bad,17).scores={Duncan:10};
  assert.throws(()=>validateLeague(bad),/betting-only/);
});

test('normalization migrates the superseded Week 16 betting period to Week 17',()=>{
  const d=league();
  d.weeks=d.weeks.filter(w=>w.week!==17);
  const w16=week(d,16);
  w16.type='betting';
  w16.matchups=[];
  w16.scores={};
  w16.bets=[{stakeCents:500,type:'single',description:'migrate me',status:'placed',payoutCents:0}];
  d.betPlacerActualBets={'16':460};

  normalizeLeague(d);
  assert.equal(week(d,16).type,'playoff');
  assert.equal(week(d,17).type,'betting');
  assert.equal(week(d,17).bets[0].description,'migrate me');
  assert.equal(d.betPlacerActualBets['17'],460);
  assert.equal(d.betPlacerActualBets['16'],undefined);
  assert.doesNotThrow(()=>validateLeague(d));
});

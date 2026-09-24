import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLeague} from '../../js/schema.js';
import {dashboardWeek} from '../../js/dashboard-week.js';

const league=()=>initialLeague();

test('public dashboard week rolls over at Wednesday noon Central',()=>{
  const d=league();
  assert.equal(dashboardWeek(d,new Date('2026-09-16T11:59:59-05:00')),1);
  assert.equal(dashboardWeek(d,new Date('2026-09-16T12:00:00-05:00')),2);
  assert.equal(dashboardWeek(d,new Date('2026-09-23T11:59:59-05:00')),2);
  assert.equal(dashboardWeek(d,new Date('2026-09-23T12:00:00-05:00')),3);
});

test('public dashboard week is independent of completed-score workflow advancement',()=>{
  const d=league();
  d.weeks.find(w=>w.week===1).scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  assert.equal(dashboardWeek(d,new Date('2026-09-16T11:00:00-05:00')),1);
});

test('public dashboard rollover stays at noon Central across daylight-saving time',()=>{
  const d=league();
  assert.equal(dashboardWeek(d,new Date('2026-11-04T11:59:59-06:00')),8);
  assert.equal(dashboardWeek(d,new Date('2026-11-04T12:00:00-06:00')),9);
});

test('public dashboard week clamps to Week 17 after the final rollover',()=>{
  const d=league();
  assert.equal(dashboardWeek(d,new Date('2027-01-15T12:00:00-06:00')),17);
});

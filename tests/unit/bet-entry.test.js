import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYER_PROPS,buildPlayerPick,parsePlayerPick,canonicalizePlayerPick,compactPlayerPick,buildSinglePick,parseSinglePick,normalizeEspnRoster} from '../../js/bet-entry.js';

test('builds compact canonical player props while accepting legacy wording',()=>{
  const pick=buildPlayerPick({player:'Josh Allen',prop:'passing yards',direction:'over',line:'274.5'});
  assert.equal(pick,'Josh Allen over 274.5 pass yds');
  assert.deepEqual(parsePlayerPick(pick),{player:'Josh Allen',direction:'over',line:274.5,prop:'passing yards'});
  assert.deepEqual(parsePlayerPick('Josh Allen over 274.5 passing yards'),{player:'Josh Allen',direction:'over',line:274.5,prop:'passing yards'});
  assert.equal(PLAYER_PROPS.find(([value])=>value==='interceptions')?.[1],'INT');
  const interceptions=buildPlayerPick({player:'Josh Allen',prop:'interceptions',direction:'under',line:'0.5'});
  assert.equal(interceptions,'Josh Allen under 0.5 INT');
  assert.deepEqual(parsePlayerPick(interceptions),{player:'Josh Allen',direction:'under',line:0.5,prop:'interceptions'});
  assert.deepEqual(parsePlayerPick('Josh Allen over 0.5 INT'),{player:'Josh Allen',direction:'over',line:0.5,prop:'interceptions'});
  assert.equal(canonicalizePlayerPick('K. Walker III Over 78.5 Rushing Yards'),'K. Walker III over 78.5 rush yds');
  assert.equal(canonicalizePlayerPick('D. Montgomery Over .5 Anytime TD'),'D. Montgomery over 0.5 anytime TD');
  assert.equal(compactPlayerPick('Patrick Mahomes over 231.5 passing yards'),'P. Mahomes over 231.5 pass yds');
  assert.equal(compactPlayerPick('Jaxon Smith-Njigba over 0.5 anytime touchdowns'),'J. Smith-Njigba over 0.5 anytime TD');
});

test('builds structured moneyline, spread, and game total descriptions',()=>{
  assert.equal(buildSinglePick({type:'moneyline',team:'BUF'}),'BUF moneyline');
  assert.equal(buildSinglePick({type:'spread',team:'BUF',line:'-3.5'}),'BUF -3.5 spread');
  assert.equal(buildSinglePick({type:'spread',team:'DET',line:'3.5'}),'DET +3.5 spread');
  assert.equal(buildSinglePick({type:'total',team:'BUF',opponent:'DET',direction:'over',line:'54.5'}),'BUF vs DET over 54.5 total');
  assert.deepEqual(parseSinglePick('BUF vs DET over 54.5 total'),{type:'total',team:'BUF',opponent:'DET',direction:'over',line:54.5});
});

test('filters ESPN roster data to active supported positions',()=>{
  const payload={athletes:[{position:{abbreviation:'QB'},items:[{id:'1',displayName:'Active QB',position:{abbreviation:'QB'},status:{name:'Active'}},{id:'2',displayName:'Inactive QB',position:{abbreviation:'QB'},status:{name:'Inactive'}}]},{position:{abbreviation:'LB'},items:[{id:'3',displayName:'Linebacker',position:{abbreviation:'LB'},status:{name:'Active'}}]}]};
  assert.deepEqual(normalizeEspnRoster(payload,{abbr:'BUF'}),[{id:'1',name:'Active QB',team:'BUF',position:'QB'}]);
});

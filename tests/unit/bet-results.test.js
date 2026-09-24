import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBetPick,evaluateBetPick,mergeEspnSummary,normalizeEspnScoreboard,playerNameMatches} from '../../js/bet-results.js';

const snapshot={season:2026,week:2,events:[
  {id:'1',name:'Seattle Seahawks at Example',completed:true,statusName:'Final',teams:[{aliases:['Seattle Seahawks','Seahawks','SEA'],score:24,winner:true},{aliases:['Example'],score:17,winner:false}],players:[{aliases:['Kenneth Walker III'],stats:{rushingYards:91,rushingTouchdowns:0,receivingTouchdowns:0}}]},
  {id:'2',name:'Philadelphia Eagles at Example',completed:true,statusName:'Final',teams:[],players:[{aliases:['Saquon Barkley'],stats:{rushingYards:72,rushingTouchdowns:0,receivingTouchdowns:0}}]},
  {id:'3',name:'Buffalo Bills at Detroit Lions',completed:true,statusName:'Final',teams:[{aliases:['Buffalo Bills','Bills','BUF'],score:31,winner:true},{aliases:['Detroit Lions','Lions','DET'],score:27,winner:false}],players:[{aliases:['David Montgomery'],stats:{rushingTouchdowns:0,receivingTouchdowns:0}},{aliases:['Jahmyr Gibbs'],stats:{rushingTouchdowns:1,receivingTouchdowns:0}},{aliases:['Josh Allen'],stats:{interceptions:1}}]}
]};

test('parses legacy and compact supported player props plus team picks',()=>{
  assert.deepEqual(parseBetPick('K. Walker III Over 78.5 Rushing Yards'),{supported:true,kind:'player-prop',raw:'K. Walker III Over 78.5 Rushing Yards',subject:'K. Walker III',direction:'over',line:78.5,stat:'rushingYards',statLabel:'rush yds'});
  assert.deepEqual(parseBetPick('K. Walker III over 78.5 rush yds'),{supported:true,kind:'player-prop',raw:'K. Walker III over 78.5 rush yds',subject:'K. Walker III',direction:'over',line:78.5,stat:'rushingYards',statLabel:'rush yds'});
  assert.equal(parseBetPick('D. Montgomery Over .5 Anytime TD').stat,'anytimeTouchdowns');
  assert.deepEqual(parseBetPick('J. Allen Over .5 INT'),{supported:true,kind:'player-prop',raw:'J. Allen Over .5 INT',subject:'J. Allen',direction:'over',line:0.5,stat:'interceptions',statLabel:'interceptions'});
  assert.deepEqual(parseBetPick('Bills to Win vs Lions'),{supported:true,kind:'team-win',raw:'Bills to Win vs Lions',team:'Bills',opponent:'Lions'});
  assert.deepEqual(parseBetPick('Buffalo Bills to beat Detroit Lions'),{supported:true,kind:'team-win',raw:'Buffalo Bills to beat Detroit Lions',team:'Buffalo Bills',opponent:'Detroit Lions'});
  assert.deepEqual(parseBetPick('BUF -3.5 spread'),{supported:true,kind:'team-spread',raw:'BUF -3.5 spread',team:'BUF',line:-3.5});
  assert.deepEqual(parseBetPick('Buffalo Bills -3.5 vs Detroit Lions'),{supported:true,kind:'team-spread',raw:'Buffalo Bills -3.5 vs Detroit Lions',team:'Buffalo Bills',opponent:'Detroit Lions',line:-3.5});
  assert.deepEqual(parseBetPick('BUF vs DET over 54.5 total'),{supported:true,kind:'team-total',raw:'BUF vs DET over 54.5 total',team:'BUF',opponent:'DET',direction:'over',line:54.5});
});

test('matches abbreviated names including suffixes',()=>{
  assert.equal(playerNameMatches('K. Walker III',['Kenneth Walker III']),true);
  assert.equal(playerNameMatches('S. Barkley',['Saquon Barkley']),true);
  assert.equal(playerNameMatches('J. Gibbs',['Jahmyr Gibbs']),true);
});

test('evaluates current Week 2 examples from final box scores in legacy and compact wording',()=>{
  assert.equal(evaluateBetPick(parseBetPick('K. Walker III Over 78.5 Rushing Yards'),snapshot).status,'hit');
  assert.equal(evaluateBetPick(parseBetPick('K. Walker III over 78.5 rush yds'),snapshot).status,'hit');
  assert.equal(evaluateBetPick(parseBetPick('S. Barkley over 94.5 rush yds'),snapshot).status,'miss');
  assert.equal(evaluateBetPick(parseBetPick('D. Montgomery over 0.5 anytime TD'),snapshot).status,'miss');
  assert.equal(evaluateBetPick(parseBetPick('J. Gibbs over 0.5 anytime TD'),snapshot).status,'hit');
  assert.equal(evaluateBetPick(parseBetPick('J. Allen over 0.5 INT'),snapshot).status,'hit');
  assert.equal(evaluateBetPick(parseBetPick('J. Allen under 1.5 INT'),snapshot).status,'hit');
  assert.equal(evaluateBetPick(parseBetPick('Bills to Win vs Lions'),snapshot).status,'won');
  assert.equal(evaluateBetPick(parseBetPick('Buffalo Bills to beat Detroit Lions'),snapshot).status,'won');
  assert.equal(evaluateBetPick(parseBetPick('BUF -3.5 spread'),snapshot).status,'won');
  assert.equal(evaluateBetPick(parseBetPick('Buffalo Bills -3.5 vs Detroit Lions'),snapshot).status,'won');
  assert.equal(evaluateBetPick(parseBetPick('DET +3.5 spread'),snapshot).status,'lost');
  assert.equal(evaluateBetPick(parseBetPick('BUF vs DET over 54.5 total'),snapshot).status,'won');
  assert.equal(evaluateBetPick(parseBetPick('BUF vs DET under 58 total'),snapshot).status,'push');
});

test('does not settle a supported pick before its game is final',()=>{
  const live=structuredClone(snapshot);live.events[0].completed=false;live.events[0].statusName='3rd Quarter';
  const result=evaluateBetPick(parseBetPick('K. Walker III over 78.5 rush yds'),live);
  assert.equal(result.settled,false);assert.equal(result.status,'pending');
});

test('unsupported prop is reported instead of guessed',()=>{
  const parsed=parseBetPick('K. Walker III Over 15.5 Fantasy Points');
  assert.equal(parsed.supported,false);assert.match(parsed.reason,/Unsupported player prop/);
});

test('normalizes ESPN scoreboard and box score keys used by evaluator',()=>{
  const [event]=normalizeEspnScoreboard({events:[{id:'99',name:'A at B',competitions:[{status:{type:{completed:true,description:'Final'}},competitors:[{score:'20',winner:true,team:{displayName:'Buffalo Bills',name:'Bills',abbreviation:'BUF'}},{score:'10',winner:false,team:{displayName:'Detroit Lions',name:'Lions',abbreviation:'DET'}}]}]}]});
  mergeEspnSummary(event,{boxscore:{players:[{statistics:[{name:'passing',keys:['completions/passingAttempts','passingYards','passingTouchdowns','interceptions'],labels:['C/ATT','YDS','TD','INT'],athletes:[{athlete:{id:'17',displayName:'Josh Allen'},stats:['22/31','255','2','1']}]},{name:'rushing',keys:['rushingAttempts','rushingYards','yardsPerRushAttempt','rushingTouchdowns'],labels:['CAR','YDS','AVG','TD'],athletes:[{athlete:{id:'7',displayName:'Kenneth Walker III'},stats:['18','91','5.1','1']}]}]}]}});
  assert.equal(event.completed,true);assert.equal(event.teams[0].winner,true);assert.equal(event.players.find(p=>p.aliases[0]==='Kenneth Walker III').stats.rushingYards,91);assert.equal(event.players.find(p=>p.aliases[0]==='Kenneth Walker III').stats.rushingTouchdowns,1);assert.equal(event.players.find(p=>p.aliases[0]==='Josh Allen').stats.interceptions,1);
});

import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';
import {SUPABASE_URL} from '../../js/config.js';

const ESPN_API='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const clone=x=>JSON.parse(JSON.stringify(x));
const week=(d,n)=>d.weeks.find(w=>w.week===n);

async function mockProduction(page,data){
  await page.route(`${SUPABASE_URL}/rest/v1/leagues**`,async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{data:clone(data)}])});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
}
async function freezeWeek2(page){
  await page.addInitScript(()=>{
    const RealDate=Date,fixed=new RealDate('2026-09-21T12:00:00-05:00');
    class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed.getTime()]))}static now(){return fixed.getTime()}}
    Date=FixedDate;
  });
}
function event(id,name,teams){return {id,name,competitions:[{status:{type:{completed:true,description:'Final'}},competitors:teams.map(([displayName,name,abbreviation,score,winner])=>({score:String(score),winner,team:{displayName,name,abbreviation}}))}]}}
function playerSummary(players){return {boxscore:{players:[{statistics:[{name:'rushing',keys:['rushingAttempts','rushingYards','yardsPerRushAttempt','rushingTouchdowns'],labels:['CAR','YDS','AVG','TD'],athletes:players.map(([id,displayName,yards,td])=>({athlete:{id,displayName},stats:['10',String(yards),'0',String(td)]}))}]}]}}}
async function mockEspn(page){
  const scoreboard={events:[
    event('sea','Seattle Seahawks at Example',[['Seattle Seahawks','Seahawks','SEA',24,true],['Example Team','Example','EX',17,false]]),
    event('phi','Philadelphia Eagles at Example',[['Philadelphia Eagles','Eagles','PHI',20,true],['Example Two','Example Two','E2',14,false]]),
    event('bufdet','Buffalo Bills at Detroit Lions',[['Buffalo Bills','Bills','BUF',31,true],['Detroit Lions','Lions','DET',27,false]])
  ]};
  await page.route(`${ESPN_API}/**`,route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/scoreboard'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(scoreboard)});
    const id=url.searchParams.get('event');
    const body=id==='sea'?playerSummary([['1','Kenneth Walker III',91,0]]):id==='phi'?playerSummary([['2','Saquon Barkley',72,0]]):playerSummary([['3','David Montgomery',44,0],['4','Jahmyr Gibbs',66,1]]);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
}

test('public dashboard shows detected outcomes read-only without changing pot accounting',async({page})=>{
  const production=initialLeague();
  week(production,1).scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  week(production,2).bets=[
    {stakeCents:1000,status:'placed',payoutCents:0,legs:[
      {player:'Duncan',pick:'K. Walker III Over 78.5 Rushing Yards',status:'pending'},
      {player:'Jacob',pick:'S. Barkley over 94.5 Rushing Yards',status:'pending'},
      {player:'Matt',pick:'D. Montgomery Over .5 Anytime TD',status:'pending'},
      {player:'Weston',pick:'J. Gibbs Over .5 Anytime TD',status:'pending'}
    ]},
    {stakeCents:500,status:'placed',payoutCents:0,description:'Bills to Win vs Lions'}
  ];
  await mockProduction(page,production);
  await mockEspn(page);
  await freezeWeek2(page);

  await page.goto('/');
  await expect(page.getByText('hit · auto',{exact:true})).toHaveCount(2);
  await expect(page.getByText('miss · auto',{exact:true})).toHaveCount(2);
  await expect(page.getByText('placed · auto won · $5.00',{exact:true})).toBeVisible();
  await expect(page.getByText('AUTO results are read-only until the commissioner saves the official status in Admin.')).toBeVisible();
  await expect(page.locator('[data-summary="pot"]')).toContainText('-$15.00');
  await expect(page.getByText('placed · $10.00',{exact:true})).toBeVisible();
});

test('public dashboard prefers commissioner-saved statuses over automatic proposals',async({page})=>{
  const production=initialLeague();
  week(production,1).scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  week(production,2).bets=[
    {stakeCents:1000,status:'lost',payoutCents:0,legs:[
      {player:'Duncan',pick:'K. Walker III Over 78.5 Rushing Yards',status:'miss'},
      {player:'Jacob',pick:'S. Barkley over 94.5 Rushing Yards',status:'hit'},
      {player:'Matt',pick:'D. Montgomery Over .5 Anytime TD',status:'miss'},
      {player:'Weston',pick:'J. Gibbs Over .5 Anytime TD',status:'hit'}
    ]},
    {stakeCents:500,status:'lost',payoutCents:0,description:'Bills to Win vs Lions'}
  ];
  await mockProduction(page,production);
  await freezeWeek2(page);
  let espnRequests=0;
  await page.route(`${ESPN_API}/**`,route=>{espnRequests++;return route.abort();});

  await page.goto('/');
  await expect(page.getByText('miss',{exact:true})).toHaveCount(2);
  await expect(page.getByText('hit',{exact:true})).toHaveCount(2);
  await expect(page.getByText('AUTO results are read-only until the commissioner saves the official status in Admin.')).toHaveCount(0);
  expect(espnRequests).toBe(0);
});

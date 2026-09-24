import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';
import {SUPABASE_URL} from '../../js/config.js';
import {SLEEPER_LEAGUE_ID} from '../../js/sleeper.js';

const SLEEPER_API='https://api.sleeper.app/v1';
const ESPN_API='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const PLAYERS=initialLeague().players;
const clone=x=>JSON.parse(JSON.stringify(x));

async function mockProduction(page,data){
  await page.route(`${SUPABASE_URL}/rest/v1/leagues**`,async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{data:clone(data)}])});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
}
async function mockSleeperMetadata(page){
  await page.route(`${SLEEPER_API}/league/**`,async route=>{
    const url=route.request().url();
    if(url.endsWith('/users'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(PLAYERS.map((player,i)=>({user_id:`u${i+1}`,display_name:`${player} Team`})))});
    if(url.endsWith('/rosters'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(PLAYERS.map((_,i)=>({roster_id:i+1,owner_id:`u${i+1}`})))});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'QA League',season:'2026'})});
  });
}
async function authenticateAdmin(page){
  await page.addInitScript(()=>{
    const session={expires_at:Date.now()+86400000};
    session[['access','token'].join('_')]='qa-session';
    session[['refresh','token'].join('_')]='qa-refresh';
    localStorage.setItem('bh_session',JSON.stringify(session));
  });
}
async function fillLeg(page,owner,{player,prop='rushing yards',direction='over',line}){
  const leg=page.locator('.structured-pick').filter({has:page.locator('.structured-pick-title',{hasText:owner})});
  const toggle=leg.locator('.structured-pick-toggle');
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await leg.locator('.bet-player').fill(player);
  await leg.locator('.bet-prop').selectOption(prop);
  await leg.locator('.bet-direction').selectOption(direction);
  await leg.locator('.bet-line').fill(String(line));
}
async function fillSingleMoneyline(page,team,opponent='Detroit Lions'){
  const single=page.locator('.single-structured');
  await single.locator('.single-type').selectOption('moneyline');
  await single.locator('.single-team').fill(team);
  const opponentInput=single.locator('.single-opponent');
  await expect(opponentInput).toHaveValue(opponent);
  await expect(opponentInput).toHaveAttribute('aria-expanded','false');
  await expect(opponentInput.locator('xpath=..').locator('.team-suggestions')).not.toHaveClass(/open/);
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
    if(url.pathname.includes('/teams/')&&url.pathname.endsWith('/roster'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({athletes:[]})});
    if(url.pathname.endsWith('/scoreboard'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(scoreboard)});
    const id=url.searchParams.get('event');
    const body=id==='sea'?playerSummary([['1','Kenneth Walker III',91,0]]):id==='phi'?playerSummary([['2','Saquon Barkley',72,0]]):playerSummary([['3','David Montgomery',44,0],['4','Jahmyr Gibbs',66,1]]);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
}

test('admin auto-check previews ESPN outcomes, then applies locally before save',async({page})=>{
  await mockProduction(page,initialLeague());
  await mockSleeperMetadata(page);
  await mockEspn(page);
  await authenticateAdmin(page);
  await page.goto('/admin/');
  await page.getByRole('button',{name:'TEST MODE',exact:true}).click();
  await page.getByRole('button',{name:'Test clean league'}).click();
  await page.getByLabel('Week to edit').selectOption('2');

  await fillLeg(page,'Duncan',{player:'K. Walker III',line:78.5});
  await fillLeg(page,'Jacob',{player:'S. Barkley',line:94.5});
  await fillLeg(page,'Matt',{player:'D. Montgomery',prop:'anytime touchdowns',line:.5});
  await fillLeg(page,'Weston',{player:'J. Gibbs',prop:'anytime touchdowns',line:.5});
  await fillSingleMoneyline(page,'Buffalo Bills');

  await page.getByRole('button',{name:'Check Week 2 results'}).click();
  await expect(page.getByText('Duncan · HIT')).toBeVisible();
  await expect(page.getByText('Jacob · MISS')).toBeVisible();
  await expect(page.getByText('Matt · MISS')).toBeVisible();
  await expect(page.getByText('Weston · HIT')).toBeVisible();
  await expect(page.getByText('$5 bet · WON')).toBeVisible();
  await expect(page.locator('select[name="legstatus-Duncan"]')).toHaveValue('pending');
  await expect(page.locator('select[name="single-status"]')).toHaveValue('placed');

  await page.locator('#apply-bet-results').click();
  await expect(page.getByText('Bets applied locally. Save when ready.')).toBeVisible();
  await expect(page.locator('select[name="legstatus-Duncan"]')).toHaveValue('hit');
  await expect(page.locator('select[name="legstatus-Jacob"]')).toHaveValue('miss');
  await expect(page.locator('select[name="legstatus-Matt"]')).toHaveValue('miss');
  await expect(page.locator('select[name="legstatus-Weston"]')).toHaveValue('hit');
  await expect(page.locator('select[name="single-status"]')).toHaveValue('won');
  await expect(page.locator('select[name="parlay-status"]')).toHaveValue('placed');
  await expect(page.locator('input[name="single-payout"]')).toHaveValue('0');

  await page.locator('#save').click();
  await page.waitForFunction(()=>{
    const data=JSON.parse(localStorage.getItem('bh_test_data')||'null');
    const week=data?.weeks?.find(w=>w.week===2);
    const parlay=week?.bets?.find(b=>b.stakeCents===1000);
    const single=week?.bets?.find(b=>b.stakeCents===500);
    return parlay?.legs?.find(l=>l.player==='Duncan')?.status==='hit'&&single?.status==='won';
  });
  await page.reload();
  await page.getByLabel('Week to edit').selectOption('2');
  await expect(page.locator('select[name="legstatus-Duncan"]')).toHaveValue('hit');
  await expect(page.locator('select[name="single-status"]')).toHaveValue('won');
  await expect(page.locator('input[name="single-payout"]')).toHaveValue('0');
});
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
async function mockEspnRosters(page){await page.route(`${ESPN_API}/teams/**/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({athletes:[]})}))}

async function authenticateAdmin(page){
  await page.addInitScript(()=>{
    const session={expires_at:Date.now()+86400000};
    session[['access','token'].join('_')]='qa-session';
    session[['refresh','token'].join('_')]='qa-refresh';
    localStorage.setItem('bh_session',JSON.stringify(session));
  });
}

async function openCleanTestMode(page,production=initialLeague()){
  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await mockEspnRosters(page);
  await authenticateAdmin(page);
  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test clean league'}).click();
}
async function fillLeg(page,owner,{player=owner,prop='rushing yards',direction='over',line=1}={}){
  const leg=page.locator('.structured-pick').filter({has:page.locator('.structured-pick-title',{hasText:owner})});
  await leg.locator('.bet-player').fill(player);
  await leg.locator('.bet-prop').selectOption(prop);
  await leg.locator('.bet-direction').selectOption(direction);
  await leg.locator('.bet-line').fill(String(line));
}
async function fillSingleMoneyline(page,team='BUF'){
  const single=page.locator('.single-structured');
  await single.locator('.single-type').selectOption('moneyline');
  await single.locator('.single-team').fill(team);
}

test('PrizePicks actual wager persists without changing live pot accounting',async({page})=>{
  await openCleanTestMode(page);
  await fillSingleMoneyline(page);
  await page.getByRole('button',{name:'Apply bets'}).click();
  await expect(page.getByRole('heading',{name:'$5 bet stake adjustments'})).toBeVisible();

  const potValue=page.locator('.hero .metric').first().locator('strong');
  const potBefore=await potValue.innerText();
  const actual=page.locator('#weekly-bet-adjustments .actual-bet');
  await actual.fill('4.60');
  await expect(page.locator('#bet-adjustment-total')).toHaveText('$0.40');
  await expect(potValue).toHaveText(potBefore);

  await page.getByRole('button',{name:'Save test changes'}).click();
  await page.reload();
  await expect(page.locator('#weekly-bet-adjustments .actual-bet')).toHaveValue('4.60');
  await expect(page.locator('#bet-adjustment-total')).toHaveText('$0.40');
  await expect(page.locator('.hero .metric').first().locator('strong')).toHaveText(potBefore);
});

test('partial parlay leg outcomes persist independently while overall parlay stays placed',async({page})=>{
  await openCleanTestMode(page);

  for(const player of PLAYERS)await fillLeg(page,player);
  await page.locator(`select[name="legstatus-${PLAYERS[0]}"]`).selectOption('hit');
  await page.locator(`select[name="legstatus-${PLAYERS[2]}"]`).selectOption('miss');
  await page.getByRole('button',{name:'Save leg results'}).click();
  await expect(page.getByText(/Parlay leg results saved to TEST MODE/)).toBeVisible();

  await page.reload();
  await expect(page.locator(`select[name="legstatus-${PLAYERS[0]}"]`)).toHaveValue('hit');
  await expect(page.locator(`select[name="legstatus-${PLAYERS[2]}"]`)).toHaveValue('miss');
  await expect(page.locator(`select[name="legstatus-${PLAYERS[1]}"]`)).toHaveValue('pending');
  await expect(page.locator(`select[name="legstatus-${PLAYERS[3]}"]`)).toHaveValue('pending');
  await expect(page.locator('select[name="parlay-status"]')).toHaveValue('placed');
});

test('TEST MODE reset restores seed and exit discards isolated data',async({page})=>{
  await openCleanTestMode(page);

  await page.getByRole('spinbutton',{name:PLAYERS[0],exact:true}).fill('111');
  await page.getByRole('spinbutton',{name:PLAYERS[1],exact:true}).fill('112');
  await page.getByRole('spinbutton',{name:PLAYERS[2],exact:true}).fill('113');
  await page.getByRole('button',{name:'Apply scores'}).click();
  await page.getByRole('button',{name:'Save test changes'}).click();
  await page.reload();
  await expect(page.getByRole('spinbutton',{name:PLAYERS[0],exact:true})).toHaveValue('111');

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Reset test data'}).click();
  await expect(page.getByRole('spinbutton',{name:PLAYERS[0],exact:true})).toHaveValue('');

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Exit & discard'}).click();
  await expect(page.getByText('TEST MODE',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Test clean league'})).toBeVisible();
});

test('Sleeper admin sync locks live dues then generates them after NFL week advances',async({page})=>{
  const production=initialLeague();
  production.sleeper={leagueId:SLEEPER_LEAGUE_ID,rosterMap:Object.fromEntries(PLAYERS.map((player,i)=>[String(i+1),player]))};
  let nflWeek=2;

  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await mockEspnRosters(page);
  await authenticateAdmin(page);
  await page.route(`${SLEEPER_API}/state/nfl`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({week:nflWeek})}));
  await page.route(`${SLEEPER_API}/league/**/matchups/2`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
    {roster_id:1,matchup_id:1,points:100},{roster_id:4,matchup_id:1,points:130},
    {roster_id:2,matchup_id:2,points:110},{roster_id:3,matchup_id:2,points:95}
  ])}));

  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test copy of production'}).click();
  await page.getByLabel('Week to edit').selectOption('2');
  const syncWeek2=page.getByRole('button',{name:'Sync Week 2 scores'});
  await expect(syncWeek2).toBeVisible({timeout:10000});
  await syncWeek2.click();
  await expect(page.getByText(/Sleeper Week 2 live scores imported locally/)).toBeVisible();
  await expect(page.getByText(new RegExp(`Week 2 · ${PLAYERS[2]} · \\$10\\.00`))).toHaveCount(0);
  await expect(page.getByText(new RegExp(`Week 2 · ${PLAYERS[0]} · \\$5\\.00`))).toHaveCount(0);

  nflWeek=3;
  await page.getByRole('button',{name:'Sync Week 2 scores'}).click();
  await expect(page.getByText(/Sleeper Week 2 final scores imported locally/)).toBeVisible();
  await expect(page.getByText(new RegExp(`Week 2 · ${PLAYERS[2]} · \\$10\\.00`))).toBeVisible();
  await expect(page.getByText(new RegExp(`Week 2 · ${PLAYERS[0]} · \\$5\\.00`))).toBeVisible();
});

test('Week 17 is betting-only in the admin UI',async({page})=>{
  await openCleanTestMode(page);
  await page.getByLabel('Week to edit').selectOption('17');

  await expect(page.getByRole('heading',{name:'Week 17 bets · Final betting week'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Matchups & scores'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sync Week 17 scores'})).toHaveCount(0);
  await expect(page.getByText(/Betting-only period after the fantasy playoffs/)).toBeVisible();
});

test('unsaved admin mutations show a sticky save control and guard sign out',async({page})=>{
  await openCleanTestMode(page);

  for(const [i,player] of PLAYERS.entries())await page.getByRole('spinbutton',{name:player,exact:true}).fill(String(100+i*10));
  await page.getByRole('button',{name:'Apply scores'}).click();

  await expect(page.locator('#unsaved-badge')).toBeVisible();
  await expect(page.locator('#save-dock')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/has-unsaved/);

  page.once('dialog',dialog=>{
    expect(dialog.message()).toContain('discard unsaved');
    dialog.dismiss();
  });
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.locator('#save-dock')).toBeVisible();

  await page.locator('#sticky-save').click();
  await expect(page.locator('#save-dock')).toBeHidden();
  await expect(page.locator('#unsaved-badge')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/has-unsaved/);

  await page.reload();
  await expect(page.getByLabel('Week to edit')).toHaveValue('2');
  await page.getByLabel('Week to edit').selectOption('1');
  await expect(page.getByRole('spinbutton',{name:PLAYERS[0],exact:true})).toHaveValue('100');
});

test('unapplied form drafts warn before changing weeks',async({page})=>{
  await openCleanTestMode(page);
  await page.getByRole('spinbutton',{name:PLAYERS[0],exact:true}).fill('123');

  page.once('dialog',dialog=>{
    expect(dialog.message()).toContain('Discard unapplied form edits');
    dialog.dismiss();
  });
  await page.getByLabel('Week to edit').selectOption('2');
  await expect(page.getByLabel('Week to edit')).toHaveValue('1');
  await expect(page.getByRole('spinbutton',{name:PLAYERS[0],exact:true})).toHaveValue('123');
});

test('weekly closeout and week selector markers surface unresolved historical work',async({page})=>{
  await openCleanTestMode(page);

  await expect(page.locator('#week-picker option[value="1"]')).toHaveText(/← CURRENT/);
  for(const [i,player] of PLAYERS.entries())await page.getByRole('spinbutton',{name:player,exact:true}).fill(String(100+i*10));
  await page.getByRole('button',{name:'Apply scores'}).click();

  await expect(page.locator('#week-picker option[value="1"]')).toHaveText(/•/);
  await expect(page.locator('#week-picker option[value="2"]')).toHaveText(/← CURRENT/);
  const closeout=page.locator('#weekly-closeout');
  await expect(closeout.getByText('Week 1',{exact:true})).toBeVisible();
  await expect(closeout).toContainText('2 dues payments unpaid');
  await expect(closeout).toContainText('$10 parlay not entered');
  await expect(closeout).toContainText('$5 bet not entered');

  const weekOneDues=page.locator('.due-paid[data-week="1"]');
  await expect(weekOneDues).toHaveCount(2);
  await weekOneDues.nth(0).check();
  await weekOneDues.nth(1).check();

  for(const player of PLAYERS){
    await fillLeg(page,player);
    await page.locator(`select[name="legstatus-${player}"]`).selectOption('hit');
  }
  await page.locator('select[name="parlay-status"]').selectOption('won');
  await fillSingleMoneyline(page);
  await page.locator('select[name="single-status"]').selectOption('lost');
  await page.getByRole('button',{name:'Apply bets'}).click();

  await expect(page.locator('#week-picker option[value="1"]')).toHaveText(/✓/);
  await expect(page.locator('#weekly-closeout').getByText('Week 1',{exact:true})).toHaveCount(0);
});

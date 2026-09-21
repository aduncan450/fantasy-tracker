import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';

const SUPABASE='https://eyjmpuwfbqzvjqcxblza.supabase.co';
const SLEEPER='https://api.sleeper.app/v1';
const clone=x=>JSON.parse(JSON.stringify(x));

async function mockProduction(page,data){
  await page.route(`${SUPABASE}/rest/v1/leagues**`,async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{data:clone(data)}])});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
}

async function mockSleeperMetadata(page){
  await page.route(`${SLEEPER}/league/**`,async route=>{
    const url=route.request().url();
    if(url.endsWith('/users'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
      {user_id:'u1',display_name:'Duncan Team'},{user_id:'u2',display_name:'Jacob Team'},
      {user_id:'u3',display_name:'Matt Team'},{user_id:'u4',display_name:'Weston Team'}
    ])});
    if(url.endsWith('/rosters'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
      {roster_id:1,owner_id:'u1'},{roster_id:2,owner_id:'u2'},{roster_id:3,owner_id:'u3'},{roster_id:4,owner_id:'u4'}
    ])});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'QA League',season:'2026'})});
  });
}

async function authenticateAdmin(page){
  await page.addInitScript(()=>localStorage.setItem('bh_session',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+86400000})));
}

async function openCleanTestMode(page,production=initialLeague()){
  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await authenticateAdmin(page);
  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test clean league'}).click();
}

test('PrizePicks actual wager persists without changing live pot accounting',async({page})=>{
  await openCleanTestMode(page);

  await page.locator('textarea[name="single-desc"]').fill('QA single bet');
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

  for(const player of ['Duncan','Jacob','Matt','Weston'])await page.locator(`textarea[name="leg-${player}"]`).fill(`${player} QA prop`);
  await page.locator('select[name="legstatus-Duncan"]').selectOption('hit');
  await page.locator('select[name="legstatus-Matt"]').selectOption('miss');
  await page.getByRole('button',{name:'Save leg results'}).click();
  await expect(page.getByText(/Parlay leg results saved to TEST MODE/)).toBeVisible();

  await page.reload();
  await expect(page.locator('select[name="legstatus-Duncan"]')).toHaveValue('hit');
  await expect(page.locator('select[name="legstatus-Matt"]')).toHaveValue('miss');
  await expect(page.locator('select[name="legstatus-Jacob"]')).toHaveValue('pending');
  await expect(page.locator('select[name="legstatus-Weston"]')).toHaveValue('pending');
  await expect(page.locator('select[name="parlay-status"]')).toHaveValue('placed');
});

test('TEST MODE reset restores seed and exit discards isolated data',async({page})=>{
  await openCleanTestMode(page);

  await page.getByRole('spinbutton',{name:'Duncan',exact:true}).fill('111');
  await page.getByRole('spinbutton',{name:'Jacob',exact:true}).fill('112');
  await page.getByRole('spinbutton',{name:'Matt',exact:true}).fill('113');
  await page.getByRole('button',{name:'Apply scores'}).click();
  await page.getByRole('button',{name:'Save test changes'}).click();
  await page.reload();
  await expect(page.getByRole('spinbutton',{name:'Duncan',exact:true})).toHaveValue('111');

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Reset test data'}).click();
  await expect(page.getByRole('spinbutton',{name:'Duncan',exact:true})).toHaveValue('');

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Exit & discard'}).click();
  await expect(page.getByText('TEST MODE',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Test clean league'})).toBeVisible();
});

test('Sleeper admin sync locks live dues then generates them after NFL week advances',async({page})=>{
  const production=initialLeague();
  production.sleeper={leagueId:'1309539123710693376',rosterMap:{'1':'Duncan','2':'Jacob','3':'Matt','4':'Weston'}};
  let nflWeek=2;

  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await authenticateAdmin(page);
  await page.route(`${SLEEPER}/state/nfl`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({week:nflWeek})}));
  await page.route(`${SLEEPER}/league/**/matchups/2`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
    {roster_id:1,matchup_id:1,points:100},{roster_id:4,matchup_id:1,points:130},
    {roster_id:2,matchup_id:2,points:110},{roster_id:3,matchup_id:2,points:95}
  ])}));

  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test copy of production'}).click();
  await page.getByLabel('Week to edit').selectOption('2');
  await page.getByRole('button',{name:'Sync Week 2 scores'}).click();
  await expect(page.getByText(/Sleeper Week 2 live scores imported locally/)).toBeVisible();
  await expect(page.getByText(/Week 2 · Matt · \$10\.00/)).toHaveCount(0);
  await expect(page.getByText(/Week 2 · Duncan · \$5\.00/)).toHaveCount(0);

  nflWeek=3;
  await page.getByRole('button',{name:'Sync Week 2 scores'}).click();
  await expect(page.getByText(/Sleeper Week 2 final scores imported locally/)).toBeVisible();
  await expect(page.getByText(/Week 2 · Matt · \$10\.00/)).toBeVisible();
  await expect(page.getByText(/Week 2 · Duncan · \$5\.00/)).toBeVisible();
});

test('Week 17 is betting-only in the admin UI',async({page})=>{
  await openCleanTestMode(page);
  await page.getByLabel('Week to edit').selectOption('17');

  await expect(page.getByRole('heading',{name:'Week 17 bets · Final betting week'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Matchups & scores'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sync Week 17 scores'})).toHaveCount(0);
  await expect(page.getByText(/Betting-only period after the fantasy playoffs/)).toBeVisible();
});

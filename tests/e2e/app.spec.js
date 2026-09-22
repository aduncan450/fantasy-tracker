import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';

const SUPABASE='https://eyjmpuwfbqzvjqcxblza.supabase.co';
const SLEEPER='https://api.sleeper.app/v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const week=(d,n)=>d.weeks.find(w=>w.week===n);
const scoreInput=(page,name)=>page.getByRole('spinbutton',{name,exact:true});

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
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'QA League',season:'2026',season_type:'regular'})});
  });
}

async function authenticateAdmin(page){
  await page.addInitScript(()=>localStorage.setItem('bh_session',JSON.stringify({
    access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+86400000
  })));
}

test('TEST MODE clean-league workflow persists scores and dues across refresh without leaking public',async({page})=>{
  const production=initialLeague();
  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await authenticateAdmin(page);

  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test clean league'}).click();
  await expect(page.getByText('TEST MODE',{exact:true}).first()).toBeVisible();

  await scoreInput(page,'Duncan').fill('120');
  await scoreInput(page,'Matt').fill('110');
  await scoreInput(page,'Jacob').fill('100');
  await scoreInput(page,'Weston').fill('130');
  await page.getByRole('button',{name:'Apply scores'}).click();

  await expect(page.getByText(/Week 1 · Jacob · \$10\.00/)).toBeVisible();
  await expect(page.getByText(/Week 1 · Matt · \$5\.00/)).toBeVisible();
  await page.getByRole('button',{name:'Save test changes'}).click();
  await expect(page.getByText(/Saved to isolated TEST MODE storage/)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Week to edit')).toHaveValue('2');
  await page.getByLabel('Week to edit').selectOption('1');
  await expect(scoreInput(page,'Duncan')).toHaveValue('120');
  await expect(scoreInput(page,'Jacob')).toHaveValue('100');
  await expect(page.getByText(/Week 1 · Jacob · \$10\.00/)).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('No completed prior weeks yet.')).toBeVisible();
  await expect(page.getByText('$15.00')).toHaveCount(0);
});

test('TEST MODE payment accounting reverses cleanly and historical score edits do not transfer payment flags',async({page})=>{
  const production=initialLeague();
  await mockProduction(page,production);
  await mockSleeperMetadata(page);
  await authenticateAdmin(page);

  await page.goto('/admin/');
  await page.getByRole('button',{name:'Test clean league'}).click();
  await page.getByLabel('Week to edit').selectOption('2');
  await scoreInput(page,'Duncan').fill('125');
  await scoreInput(page,'Jacob').fill('110');
  await scoreInput(page,'Matt').fill('95');
  await scoreInput(page,'Weston').fill('130');
  await page.getByRole('button',{name:'Apply scores'}).click();

  const mattCharge=page.locator('.history-row').filter({hasText:'Week 2 · Matt · $10.00'}).getByRole('checkbox');
  const duncanCharge=page.locator('.history-row').filter({hasText:'Week 2 · Duncan · $5.00'}).getByRole('checkbox');
  await mattCharge.check();
  await duncanCharge.check();
  await expect(page.locator('.hero .metric').first()).toContainText('$15.00');

  await scoreInput(page,'Duncan').fill('90');
  await scoreInput(page,'Jacob').fill('110');
  await scoreInput(page,'Matt').fill('125');
  await scoreInput(page,'Weston').fill('130');
  await page.getByRole('button',{name:'Apply scores'}).click();

  await expect(page.getByText(/Week 2 · Duncan · \$10\.00/)).toBeVisible();
  await expect(page.getByText(/Week 2 · Jacob · \$5\.00/)).toBeVisible();
  await expect(page.locator('.hero .metric').first()).toContainText('$0.00');
});

test('public dashboard overlays current-week Sleeper scores without changing canonical accounting',async({page})=>{
  const production=initialLeague();
  week(production,1).scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  production.sleeper={leagueId:'1309539123710693376',rosterMap:{'1':'Duncan','2':'Jacob','3':'Matt','4':'Weston'}};
  production.metadata.lastUpdated='2026-09-20T20:00:00.000Z';
  await mockProduction(page,production);

  await page.route(`${SLEEPER}/state/nfl`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({week:2})}));
  await page.route(`${SLEEPER}/league/**/matchups/2`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
    {roster_id:1,matchup_id:1,points:159.14},{roster_id:4,matchup_id:1,points:146.22},
    {roster_id:3,matchup_id:2,points:166.08},{roster_id:2,matchup_id:2,points:168.10}
  ])}));

  await page.goto('/');
  await expect(page.getByText('LIVE',{exact:true})).toBeVisible();
  await expect(page.getByText('SLEEPER',{exact:true})).toBeVisible();
  await expect(page.getByText('159.14',{exact:true})).toBeVisible();
  await expect(page.getByText('168.1',{exact:true})).toBeVisible();
  await expect(page.getByText('146.22',{exact:true})).toBeVisible();
  await expect(page.locator('[data-summary="pot"]')).toContainText('$0.00');
});

test('public dashboard falls back to saved tracker data when Sleeper is unavailable',async({page})=>{
  const production=initialLeague();
  week(production,1).scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  production.sleeper={leagueId:'1309539123710693376',rosterMap:{'1':'Duncan','2':'Jacob','3':'Matt','4':'Weston'}};
  production.metadata.lastUpdated='2026-09-20T20:00:00.000Z';
  await mockProduction(page,production);
  await page.route(`${SLEEPER}/state/nfl`,route=>route.abort());

  await page.goto('/');
  await expect(page.locator('.matchup-feature .section-status')).toHaveText('UPCOMING');
  await expect(page.getByText('LIVE',{exact:true})).toHaveCount(0);
  await expect(page.getByText('No completed prior weeks yet.')).toHaveCount(0);
});

import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';

const SUPABASE='https://eyjmpuwfbqzvjqcxblza.supabase.co';
const SLEEPER='https://api.sleeper.app/v1';
const clone=x=>JSON.parse(JSON.stringify(x));

async function mockProduction(page,data=initialLeague()){
  await page.route(`${SUPABASE}/rest/v1/leagues**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{data:clone(data)}])}));
}
async function mockSleeper(page){
  await page.route(`${SLEEPER}/league/**`,route=>{
    const url=route.request().url();
    if(url.endsWith('/users'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(url.endsWith('/rosters'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'QA League',season:'2026',season_type:'regular'})});
  });
}

test('admin discards incomplete TEST MODE storage instead of rendering a blank portal',async({page})=>{
  await mockProduction(page);
  await mockSleeper(page);
  await page.addInitScript(()=>{
    localStorage.setItem('bh_session',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+86400000}));
    localStorage.setItem('bh_test_mode','1');
    localStorage.removeItem('bh_test_data');
    localStorage.removeItem('bh_test_seed');
  });
  await page.goto('/admin/');
  await expect(page.getByText('Broken TEST MODE data was discarded. Production data reloaded.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Test clean league'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('bh_test_mode'))).toBeNull();
});

test('admin shows a startup error card when production data cannot load',async({page})=>{
  await page.route(`${SUPABASE}/rest/v1/leagues**`,route=>route.fulfill({status:500,contentType:'application/json',body:'{}'}));
  await page.goto('/admin/');
  await expect(page.getByRole('heading',{name:'Admin failed to start'})).toBeVisible();
  await expect(page.getByText('Could not load league data.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Reload admin'})).toBeVisible();
});

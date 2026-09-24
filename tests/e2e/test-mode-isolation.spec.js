import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';

const SUPABASE='https://eyjmpuwfbqzvjqcxblza.supabase.co';
const SLEEPER='https://api.sleeper.app/v1';
const clone=x=>JSON.parse(JSON.stringify(x));

test('TEST MODE save fails closed if its localStorage flag is lost mid-session',async({page})=>{
  const production=initialLeague(),writes=[];
  await page.route(`${SUPABASE}/rest/v1/leagues**`,async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{data:clone(production)}])});
    writes.push({method:route.request().method(),body:route.request().postData()});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.route(`${SLEEPER}/league/**`,async route=>{
    const url=route.request().url();
    if(url.endsWith('/users'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(url.endsWith('/rosters'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'QA League',season:'2026',season_type:'regular'})});
  });
  await page.addInitScript(()=>localStorage.setItem('bh_session',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+86400000})));

  await page.goto('/admin/');
  await page.locator('#open-test-mode').click();
  const cleanButton=page.locator('#test-clean-dialog');
  await expect(cleanButton).toBeVisible();
  await cleanButton.click();
  await expect(page.getByText('TEST MODE',{exact:true}).first()).toBeVisible();

  await page.evaluate(()=>localStorage.removeItem('bh_test_mode'));
  await page.locator('#save').click();

  await expect(page.locator('.card.success,.card.error').first()).toContainText('Saved to isolated TEST MODE storage');
  expect(writes).toHaveLength(0);
  expect(await page.evaluate(()=>localStorage.getItem('bh_test_mode'))).toBe('1');
  expect(await page.evaluate(()=>localStorage.getItem('bh_test_data'))).not.toBeNull();
});

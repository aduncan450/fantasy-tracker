import {test,expect} from '@playwright/test';
import {initialLeague} from '../../js/schema.js';
import {SUPABASE_URL} from '../../js/config.js';

const clone=x=>JSON.parse(JSON.stringify(x));
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

test('public dashboard keeps the branded layout compact and status-localized',async({page})=>{
  const production=initialLeague();
  await mockProduction(page,production);
  await freezeWeek2(page);
  await page.goto('/');

  await expect(page.locator('.brand-title')).toHaveText(/BUFF HUSKY FANTASY TRACKER/);
  await expect(page.locator('#season-context')).toHaveText(/2026–2027 SEASON \| WEEK 2/);
  await expect(page.locator('[data-summary="week"]')).toContainText('Week');
  await expect(page.locator('[data-summary="pot"]')).toContainText('Pot');
  await expect(page.locator('.matchup-feature .section-status')).toHaveText('UPCOMING');
  await expect(page.locator('.matchup-feature .current-dues')).toHaveCount(0);
  await expect(page.locator('.bets-card .section-status')).toHaveCount(0);
  await expect(page.locator('.brand-art')).toHaveCount(0);
  await expect(page.getByText(/scores refresh from sleeper/i)).toHaveCount(0);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('completed current matchup shows compact dues only after final scores',async({page})=>{
  const production=initialLeague();
  const week2=production.weeks.find(w=>w.week===2);
  week2.scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  await mockProduction(page,production);
  await freezeWeek2(page);
  await page.goto('/');

  const current=page.locator('.matchup-feature');
  await expect(current.locator('.section-status')).toHaveText('FINAL');
  await expect(current.locator('.current-dues .pill')).toHaveCount(2);
});

test('completed matchup styling keeps winner and loser cues distinct with compact right-aligned dues',async({page})=>{
  const production=initialLeague();
  const week1=production.weeks.find(w=>w.week===1);
  week1.scores={Duncan:120,Matt:110,Jacob:100,Weston:130};
  await mockProduction(page,production);
  await freezeWeek2(page);
  await page.goto('/');

  const result=page.locator('.result-week').filter({hasText:'Week 1'});
  await expect(result.locator('.winner')).toHaveCount(2);
  await expect(result.locator('.winner-trophy')).toHaveCount(2);
  await expect(result.locator('.score-ten')).toHaveCount(1);
  await expect(result.locator('.score-five')).toHaveCount(1);
  await expect(result.locator('.section-status')).toHaveText('FINAL');
  await expect(result.locator('.compact-dues .pill')).toHaveCount(2);
  await expect(result).not.toContainText('lowest score this week');
  await expect(result).not.toContainText('lost the other matchup');
  const alignment=await result.locator('.compact-dues').evaluate(el=>getComputedStyle(el).justifyContent);
  expect(alignment).toBe('flex-end');
});

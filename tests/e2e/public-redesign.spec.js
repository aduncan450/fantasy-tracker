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

test('public parlay legs use compact one-line wording without mobile overflow',async({page})=>{
  const production=initialLeague();
  const week2=production.weeks.find(w=>w.week===2);
  week2.bets=[{stakeCents:1000,type:'parlay',description:'$10 parlay',status:'lost',payoutCents:0,legs:[
    {player:'Duncan',pick:'K. Walker III Over 78.5 Rushing Yards',status:'hit'},
    {player:'Jacob',pick:'S. Barkley over 94.5 Rushing Yards',status:'miss'},
    {player:'Matt',pick:'D. Montgomery Over .5 Anytime TD',status:'miss'},
    {player:'Weston',pick:'J. Gibbs Over .5 Anytime TD',status:'hit'}
  ]}];
  await mockProduction(page,production);
  await freezeWeek2(page);
  await page.goto('/');

  const picks=page.locator('.bets-card .parlay-leg > span');
  await expect(picks).toHaveCount(4);
  await expect(picks.nth(0)).toHaveText('K. Walker III over 78.5 rush yds');
  await expect(picks.nth(1)).toHaveText('S. Barkley over 94.5 rush yds');
  await expect(picks.nth(2)).toHaveText('D. Montgomery over 0.5 anytime TD');
  const oneLine=await picks.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).whiteSpace==='nowrap'));
  expect(oneLine).toBe(true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
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

test('public $5 card shows split team names with official ESPN team logo assets',async({page})=>{
  const production=initialLeague();
  const week2=production.weeks.find(w=>w.week===2);
  week2.bets=[{stakeCents:500,status:'won',payoutCents:600,description:'Bills to Win vs Lions'}];
  await mockProduction(page,production);
  await freezeWeek2(page);
  await page.goto('/');

  const card=page.locator('.single-bet-card');
  await expect(card).toContainText('Buffalo Bills vs Detroit Lions');
  await expect(card.locator('.single-team-pick .single-team-location')).toHaveText('Buffalo');
  await expect(card.locator('.single-team-pick .single-team-name')).toHaveText('Bills');
  await expect(card.locator('.single-team-opponent .single-team-location')).toHaveText('Detroit');
  await expect(card.locator('.single-team-opponent .single-team-name')).toHaveText('Lions');
  await expect(card.locator('.single-venue')).toBeVisible();
  await expect(card.locator('.bet-title-copy small')).toHaveText('Moneyline');
  const logos=card.locator('.single-team-logo');
  await expect(logos).toHaveCount(2);
  await expect(logos.nth(0)).toHaveAttribute('src','https://a.espncdn.com/i/teamlogos/nfl/500/buf.png');
  await expect(logos.nth(1)).toHaveAttribute('src','https://a.espncdn.com/i/teamlogos/nfl/500/det.png');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

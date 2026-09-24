import {findNflTeam} from './bet-entry.js?v=20260924-pot-activity1';

const BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
let schedulePromise=null;
const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function seasonWeek(){
  const text=document.querySelector('#season-context')?.textContent||'';
  return {season:Number(text.match(/\b(20\d{2})\b/)?.[1]||0),week:Number(text.match(/WEEK\s+(\d+)/i)?.[1]||0)};
}
function schedule(){
  if(schedulePromise)return schedulePromise;
  const {season,week}=seasonWeek();
  if(!season||!week)return Promise.resolve([]);
  schedulePromise=fetch(`${BASE}/scoreboard?dates=${season}&seasontype=2&week=${week}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('schedule unavailable'))).then(payload=>(payload?.events||[]).map(event=>event?.competitions?.[0]?.competitors||[])).catch(()=>[]);
  return schedulePromise;
}
function teamParts(team){return `<span class="single-team-location">${esc(team.location)}</span><strong class="single-team-name">${esc(team.name)}</strong>`}
function venueFor(team,opponent,games){
  for(const competitors of games){
    const mine=competitors.find(c=>String(c?.team?.abbreviation||'').toUpperCase()===team.abbr),other=competitors.find(c=>String(c?.team?.abbreviation||'').toUpperCase()===opponent.abbr);
    if(mine&&other)return mine.homeAway==='away'?'@':'vs';
  }
  return '·';
}
async function enhanceCard(card){
  if(card.dataset.matchupLayout==='1')return;
  const footer=card.querySelector('.single-bet-footer>span:first-child'),matchup=card.querySelector('.single-matchup');
  if(!footer||!matchup)return;
  const names=footer.textContent.split(/\s+vs\s+/i).map(x=>x.trim());
  const team=findNflTeam(names[0]),opponent=findNflTeam(names[1]);
  if(!team||!opponent)return;
  card.dataset.matchupLayout='1';
  matchup.innerHTML=`<img class="single-team-logo" src="${esc(team.logoUrl)}" alt="" aria-hidden="true" loading="lazy"><div class="single-team-copy single-team-pick">${teamParts(team)}</div><span class="single-venue" aria-label="matchup venue">·</span><div class="single-team-copy single-team-opponent">${teamParts(opponent)}</div><img class="single-team-logo" src="${esc(opponent.logoUrl)}" alt="" aria-hidden="true" loading="lazy">`;
  const outcome=card.querySelector('.bet-outcome')?.textContent?.trim().toLowerCase();
  if(!['placed','live'].includes(outcome))return;
  const games=await schedule();
  const venue=venueFor(team,opponent,games),marker=matchup.querySelector('.single-venue');
  if(marker)marker.textContent=venue;
}
function enhance(){document.querySelectorAll('.single-bet-card').forEach(card=>enhanceCard(card))}

new MutationObserver(enhance).observe(app,{childList:true,subtree:true});
enhance();

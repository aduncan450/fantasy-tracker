import {findNflTeam,teamFullName} from './bet-entry.js?v=20260924-bet-matchup2';

const BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const cache=new Map();
const admin=()=>window.__fantasyAdmin;

function seasonYear(){
  const data=admin()?.getData?.(),text=`${data?.season?.label||''} ${data?.id||''}`;
  return Number(text.match(/\b(20\d{2})\b/)?.[1]||new Date().getFullYear());
}
function selectedWeek(){return Number(document.querySelector('#week-picker')?.value||0)}
function teamAbbr(team){return String(team?.abbreviation||'').toUpperCase()}
function closeOpponentSuggestions(opponent){
  opponent.parentElement?.querySelector('.team-suggestions')?.classList.remove('open');
  opponent.setAttribute('aria-expanded','false');
}
async function schedule(){
  const season=seasonYear(),week=selectedWeek(),key=`${season}-${week}`;
  if(!week)return [];
  if(!cache.has(key))cache.set(key,fetch(`${BASE}/scoreboard?dates=${season}&seasontype=2&week=${week}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('schedule unavailable'))).then(payload=>(payload?.events||[]).flatMap(event=>event?.competitions?.[0]?.competitors?.map(c=>({abbr:teamAbbr(c.team),homeAway:c.homeAway,event}))||[])).catch(()=>[]));
  return cache.get(key);
}
async function fillOpponent(input){
  const pick=findNflTeam(input.value),wrap=input.closest('.single-structured'),opponent=wrap?.querySelector('.single-opponent');
  if(!opponent)return;
  opponent.readOnly=true;
  opponent.setAttribute('aria-readonly','true');
  opponent.placeholder='Autofills from NFL schedule';
  if(!pick){opponent.value='';closeOpponentSuggestions(opponent);return}
  const rows=await schedule(),mine=rows.find(row=>row.abbr===pick.abbr);
  if(!mine)return;
  const competition=mine.event?.competitions?.[0],other=competition?.competitors?.find(c=>teamAbbr(c.team)!==pick.abbr),otherTeam=findNflTeam(teamAbbr(other?.team));
  if(!otherTeam)return;
  const next=teamFullName(otherTeam.full);
  if(opponent.value!==next){opponent.value=next;opponent.dispatchEvent(new Event('input',{bubbles:true}))}
  closeOpponentSuggestions(opponent);
  wrap.dataset.venue=mine.homeAway==='away'?'@':'vs';
}
function enhance(){
  const week=selectedWeek(),form=document.querySelector('#bets');
  if(!form)return;
  const card=form.closest('.card');
  if(week===1){if(card)card.hidden=true;return}
  if(card)card.hidden=false;
  const input=form.querySelector('.single-team'),opponent=form.querySelector('.single-opponent');
  if(!input||!opponent)return;
  opponent.readOnly=true;
  opponent.setAttribute('aria-readonly','true');
  opponent.placeholder='Autofills from NFL schedule';
  closeOpponentSuggestions(opponent);
  if(form.dataset.scheduleAutofill!=='1'){
    form.dataset.scheduleAutofill='1';
    input.addEventListener('input',()=>fillOpponent(input));
    input.addEventListener('change',()=>fillOpponent(input));
  }
  fillOpponent(input);
}

window.addEventListener('fantasy-admin-rendered',enhance);
enhance();

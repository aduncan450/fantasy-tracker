import {loadLeague} from './storage.js?v=20260923-compact-parlay1';
import {ledger,money} from './calculations.js?v=20260921-public-bet-results';
import {compactSingleActivity} from './bet-entry.js?v=20260924-pot-activity1';
import {dashboardWeek} from './dashboard-week.js?v=20260923-wed-noon1';

const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function activityLabel(row){
  let label=String(row.label||'');
  if(row.kind==='dues-payment')return label.replace(' paid — lowest score this week',' — lowest score').replace(' paid — lost the other matchup',' — lost');
  if(row.kind==='stake'||row.kind==='payout'){
    label=label.replace(/ payout$/i,'');
    if(label.toLowerCase()==='$10 parlay')return 'Parlay';
    const compact=compactSingleActivity(label);
    if(compact!==label)return compact;
  }
  return label;
}

function rowHtml(row){
  return `<div class="history-row"><span>${row.season?'SEASON':`W${row.week??'—'}`} · ${esc(activityLabel(row))}</span><b>${row.amountCents>=0?'+':''}${money(row.amountCents)}</b></div>`;
}

function potActivityCard(){
  return [...app.querySelectorAll('.card')].find(card=>card.querySelector('.section-main-label')?.textContent.trim().toLowerCase()==='pot activity');
}

async function renderFullHistory(){
  try{
    const data=await loadLeague();
    const card=potActivityCard(),history=card?.querySelector('.history');
    if(!history)return;

    const current=dashboardWeek(data),recentWeeks=new Set([current,current-1].filter(week=>week>=1));
    const rows=ledger(data).slice().reverse();
    const recent=rows.filter(row=>row.season||recentWeeks.has(Number(row.week)));
    const older=rows.filter(row=>!row.season&&!recentWeeks.has(Number(row.week)));

    history.innerHTML=recent.map(rowHtml).join('')||'<p class="muted">No activity yet.</p>';
    if(!older.length)return;

    const details=document.createElement('details');
    details.className='pot-history-more';
    details.innerHTML=`<summary>Load more history</summary><div class="pot-history-older">${older.map(rowHtml).join('')}</div>`;
    history.append(details);
  }catch(error){
    console.warn('Full pot activity history unavailable; keeping the default recent activity.',error);
  }
}

renderFullHistory();

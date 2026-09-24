import {loadLeague} from './storage.js?v=20260923-compact-parlay1';
import {ledger,money} from './calculations.js?v=20260921-public-bet-results';
import {compactSingleActivity} from './bet-entry.js?v=20260924-pot-activity1';
import {dashboardWeek} from './dashboard-week.js?v=20260923-wed-noon1';

const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let rendered=false;

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
  if(rendered)return true;
  const card=potActivityCard(),history=card?.querySelector('.history');
  if(!history)return false;

  try{
    const data=await loadLeague();
    const current=dashboardWeek(data),recentWeeks=new Set([current,current-1].filter(week=>week>=1));
    const rows=ledger(data).slice().reverse();
    const recent=rows.filter(row=>row.season||recentWeeks.has(Number(row.week)));
    const older=rows.filter(row=>!row.season&&!recentWeeks.has(Number(row.week)));

    const recentHtml=recent.map(rowHtml).join('')||'<p class="muted">No activity yet.</p>';
    history.innerHTML=recentHtml;

    if(older.length){
      const button=document.createElement('button');
      button.type='button';
      button.className='pot-history-load-more';
      button.textContent='Load more history';
      button.addEventListener('click',()=>{
        history.innerHTML=rows.map(rowHtml).join('')||'<p class="muted">No activity yet.</p>';
      },{once:true});
      history.append(button);
    }

    rendered=true;
    return true;
  }catch(error){
    console.warn('Full pot activity history unavailable; keeping the default recent activity.',error);
    return true;
  }
}

if(!await renderFullHistory()){
  const observer=new MutationObserver(async()=>{
    if(await renderFullHistory())observer.disconnect();
  });
  observer.observe(app,{childList:true,subtree:true});
}

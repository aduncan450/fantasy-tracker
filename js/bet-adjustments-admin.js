import {loadLeague,saveLeague,session} from './storage.js';
import {money} from './calculations.js';

const EXPECTED_CENTS=500;
const ADJUSTMENT_KIND='season-bet-placer-adjustment';
const ADJUSTMENT_LABEL='Season bet placer stake adjustment';
let busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const actualFor=(data,week)=>{const v=data.betPlacerActualBets?.[String(week)];return Number.isFinite(Number(v))?Number(v):null};
const owedFor=(data,week)=>{const actual=actualFor(data,week);return actual===null?null:Math.max(0,EXPECTED_CENTS-actual)};
const trackedWeeks=data=>data.weeks.filter(w=>(w.bets||[]).some(b=>b.stakeCents===500)).sort((a,b)=>a.week-b.week);
const totalOwed=data=>trackedWeeks(data).reduce((sum,w)=>sum+(owedFor(data,w.week)||0),0);

function removeOldCard(){for(const h of document.querySelectorAll('#app h2'))if(h.textContent.trim()==='Bet placer pot adjustment')h.closest('section')?.remove()}
function card(data){const weeks=trackedWeeks(data),total=totalOwed(data),applied=(data.adjustments||[]).find(a=>a.kind===ADJUSTMENT_KIND);return `<section class="card" id="weekly-bet-adjustments"><p class="eyebrow">Admin only</p><h2>$5 bet stake adjustments</h2><p class="muted">Enter the amount actually wagered each week. The tracker calculates $5.00 minus the actual PrizePicks stake. These details stay admin-only until you apply the season total to the public pot activity.</p>${weeks.length?`<div class="history">${weeks.map(w=>{const actual=actualFor(data,w.week),owed=owedFor(data,w.week);return `<div class="history-row bet-adjustment-row"><span>Week ${w.week}</span><label>Actual bet<input class="actual-bet" data-week="${w.week}" type="number" min="0" max="5" step="0.01" value="${actual===null?'':(actual/100).toFixed(2)}" placeholder="5.00"></label><span class="bet-adjustment-diff">Owes pot <b>${owed===null?'—':money(owed)}</b></span></div>`}).join('')}</div>`:'<p class="muted">A week will appear here after its $5 bet is entered.</p>'}<div class="payout-row"><span>Season total owed to pot <small>${weeks.length} tracked week${weeks.length===1?'':'s'}</small></span><strong>${money(total)}</strong></div><div class="actions"><button id="save-bet-adjustments" type="button" class="ghost">Save weekly amounts</button><button id="publish-bet-adjustment" type="button" ${weeks.length?'':'disabled'}>${applied?'Update public dashboard':'Apply to public dashboard'}</button></div>${applied?`<p class="muted">Public season line item currently applied: ${money(applied.amountCents)}</p>`:''}</section>`}

async function render(){if(busy)return;removeOldCard();document.querySelector('#weekly-bet-adjustments')?.remove();const auth=await session();if(!auth)return;const data=await loadLeague();removeOldCard();const app=document.querySelector('#app');if(!app)return;app.insertAdjacentHTML('beforeend',card(data));wire(data,auth)}
function collect(data){data.betPlacerActualBets=data.betPlacerActualBets||{};for(const input of document.querySelectorAll('.actual-bet')){const raw=input.value.trim(),week=input.dataset.week;if(raw===''){delete data.betPlacerActualBets[week];continue}const dollars=Number(raw);if(!Number.isFinite(dollars)||dollars<0||dollars>5)throw new Error(`Week ${week} actual bet must be between $0 and $5.`);data.betPlacerActualBets[week]=Math.round(dollars*100)}delete data.betPlacerOwesPotCents;delete data.betPlacerOwedCents;return data}
function wire(data,auth){document.querySelector('#save-bet-adjustments')?.addEventListener('click',async()=>{try{busy=true;collect(data);await saveLeague(data,auth.access_token);busy=false;await render()}catch(e){busy=false;alert(e.message)}});document.querySelector('#publish-bet-adjustment')?.addEventListener('click',async()=>{try{busy=true;collect(data);const amountCents=totalOwed(data);data.adjustments=data.adjustments||[];let row=data.adjustments.find(a=>a.kind===ADJUSTMENT_KIND);if(row)Object.assign(row,{week:null,season:true,amountCents,reason:ADJUSTMENT_LABEL});else data.adjustments.push({week:null,season:true,kind:ADJUSTMENT_KIND,amountCents,reason:ADJUSTMENT_LABEL});await saveLeague(data,auth.access_token);busy=false;await render()}catch(e){busy=false;alert(e.message)}})}

const observer=new MutationObserver(()=>{if(!busy&&!document.querySelector('#weekly-bet-adjustments'))setTimeout(render,0);else removeOldCard()});
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
render();

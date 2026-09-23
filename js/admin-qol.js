import {currentWeek,duesRows,weekResult} from './calculations.js?v=20260920-live-sleeper';

const app=document.querySelector('#app');
let dirty=false,draftDirty=false,lastWeekValue=null,draftWeekValue=null,renderQueued=false;
const handledMessages=new WeakSet();
const admin=()=>window.__fantasyAdmin;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const settled=b=>Boolean(b)&&['won','lost','push','void'].includes(b.status);

function syncDirtyUi(){
  document.body.classList.toggle('has-unsaved',dirty);
  const badge=document.querySelector('#unsaved-badge'),dock=document.querySelector('#save-dock');
  if(badge&&badge.hidden===dirty)badge.hidden=!dirty;
  if(dock&&dock.hidden===dirty)dock.hidden=!dirty;
  if(dock){
    const note=dock.querySelector('[data-save-note]');
    const text=draftDirty?'Unapplied form edits still need their Apply action. This saves already-applied changes.':document.body.classList.contains('test-mode')?'Save to isolated TEST MODE storage before leaving.':'Save to Supabase before leaving the admin portal.';
    if(note&&note.textContent!==text)note.textContent=text;
  }
}
function markDirty(){dirty=true;syncDirtyUi()}
function clearDirty(){dirty=false;syncDirtyUi()}
function markDraft(){if(!draftDirty)draftWeekValue=document.querySelector('#week-picker')?.value||lastWeekValue;draftDirty=true;syncDirtyUi()}
function clearDraft(){draftDirty=false;draftWeekValue=null;syncDirtyUi()}
function discardGuard(message){return (!dirty&&!draftDirty)||confirm(message)}
window.addEventListener('beforeunload',e=>{if(!dirty&&!draftDirty)return;e.preventDefault();e.returnValue=''});

function legacyLegs(data,b){
  if(b?.legs?.length)return b.legs;
  const lines=String(b?.description||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return data.players.map((p,i)=>({player:p,pick:(lines[i]||'').replace(new RegExp(`^${p}\\s*[-–—:]\\s*`,'i'),''),status:'pending'}));
}
function weekHasActivity(data,w){
  const scores=Object.values(w.scores||{}).some(v=>v!==''&&v!==null&&v!==undefined);
  return scores||(w.bets||[]).length>0||Object.keys(w.payments||{}).length>0||Boolean(w.sleeperScoresSyncedAt)||Object.prototype.hasOwnProperty.call(data.betPlacerActualBets||{},String(w.week));
}
function closeout(data,w,workflowWeek,dues){
  const started=w.week<=workflowWeek||weekHasActivity(data,w);
  if(!started)return {week:w.week,started:false,isCurrent:false,needsAttention:false,checks:[]};
  const checks=[];
  if(w.type!=='betting'){
    const result=weekResult(w);
    checks.push({ok:result.complete,label:result.complete?'Scores final':result.live?'Scores still live':result.tie?result.reason:'Scores not final'});
    if(w.type==='regular'&&result.complete){
      const unpaid=dues.filter(x=>x.week===w.week&&!x.paid);
      checks.push({ok:unpaid.length===0,label:unpaid.length?`${unpaid.length} dues payment${unpaid.length===1?'':'s'} unpaid`:'Dues paid'});
    }
  }
  if(w.week>1){
    const parlay=(w.bets||[]).find(b=>b.stakeCents===1000);
    if(!parlay)checks.push({ok:false,label:'$10 parlay not entered'});
    else{
      checks.push({ok:settled(parlay),label:settled(parlay)?'Parlay overall status settled':'Parlay overall status unsettled'});
      const legs=legacyLegs(data,parlay),pending=data.players.filter(player=>!legs.find(l=>l.player===player)||legs.find(l=>l.player===player)?.status==='pending').length;
      checks.push({ok:pending===0,label:pending?`${pending} parlay leg outcome${pending===1?'':'s'} pending`:'Parlay leg outcomes settled'});
    }
    const single=(w.bets||[]).find(b=>b.stakeCents===500);
    checks.push({ok:settled(single),label:!single?'$5 bet not entered':settled(single)?'$5 bet settled':'$5 bet unsettled'});
  }
  return {week:w.week,started:true,isCurrent:w.week===workflowWeek,needsAttention:checks.some(x=>!x.ok),checks};
}
function summaries(data){
  const workflowWeek=currentWeek(data),dues=duesRows(data);
  return {workflowWeek,rows:data.weeks.map(w=>closeout(data,w,workflowWeek,dues))};
}
function decorateWeekPicker(data){
  const select=document.querySelector('#week-picker');
  if(!select)return;
  const {workflowWeek,rows}=summaries(data),byWeek=new Map(rows.map(x=>[x.week,x]));
  for(const option of select.options){
    const week=Number(option.value),w=data.weeks.find(x=>x.week===week),row=byWeek.get(week);
    if(!w)continue;
    const type=w.type==='playoff'?' · Playoffs':w.type==='betting'?' · Final betting':'';
    const marker=!row?.started?'':week===workflowWeek?' · ← CURRENT':row.needsAttention?' · •':' · ✓';
    const text=`Week ${week}${type}${marker}`;
    if(option.textContent!==text)option.textContent=text;
  }
  lastWeekValue=select.value;
}
function closeoutCard(data){
  const {rows}=summaries(data),visible=rows.filter(x=>x.started&&(x.needsAttention||x.isCurrent)),older=rows.filter(x=>x.started&&x.needsAttention&&!x.isCurrent).length;
  return `<section class="card" id="weekly-closeout"><p class="eyebrow">Commissioner checklist</p><h2>Weekly closeout</h2><p class="muted">${older?`${older} older week${older===1?'':'s'} need${older===1?'s':''} attention.`:'All earlier started weeks are clear.'} This status is derived from tracker data and is never stored separately.</p><div class="closeout-list">${visible.length?visible.map(row=>`<div class="closeout-week"><div class="closeout-head"><strong>Week ${row.week}</strong><span class="closeout-state ${row.isCurrent?'current':'attention'}">${row.isCurrent?'Current':'Needs attention'}</span></div><div class="closeout-checks">${row.checks.map(c=>`<span class="closeout-check ${c.ok?'ok':'attention'}">${c.ok?'✓':'•'} ${esc(c.label)}</span>`).join('')}</div></div>`).join(''):'<p class="muted">No started weeks need attention.</p>'}</div></section>`;
}
function ensureActions(){
  const actions=document.querySelector('#save')?.closest('.actions');
  if(actions&&!document.querySelector('#unsaved-badge'))actions.insertAdjacentHTML('beforeend','<span id="unsaved-badge" class="unsaved-badge" hidden>Unsaved changes</span>');
}
function ensureDock(){
  if(!admin()?.isAuthenticated?.()||document.querySelector('#save-dock'))return;
  app.insertAdjacentHTML('beforeend','<section id="save-dock" class="save-dock" hidden><div><strong>Unsaved changes</strong><span data-save-note></span></div><button id="sticky-save" type="button">Save now</button></section>');
  document.querySelector('#sticky-save')?.addEventListener('click',()=>document.querySelector('#save')?.click());
}
function ensureCloseout(data){
  if(!document.querySelector('#week-picker'))return;
  const anchor=document.querySelector('.admin-utility-card')||document.querySelector('.admin-sticky-status')||document.querySelector('.hero');
  if(!anchor)return;
  const html=closeoutCard(data),existing=document.querySelector('#weekly-closeout');
  if(existing?.outerHTML===html)return;
  existing?.remove();
  anchor.insertAdjacentHTML('afterend',html);
}
function renderEnhancements(){
  const bridge=admin();
  if(!bridge?.isAuthenticated?.())return;
  const data=bridge.getData?.();
  if(!data)return;
  ensureActions();
  decorateWeekPicker(data);
  ensureCloseout(data);
  ensureDock();
  syncDirtyUi();
}
function reconcileAfterRender(){
  for(const card of app.querySelectorAll('.card.success,.card.error')){
    if(handledMessages.has(card))continue;
    handledMessages.add(card);
    const text=card.textContent.trim();
    if(/Saved to Supabase\.|Saved to isolated TEST MODE storage\.|Parlay leg results saved/.test(text)){clearDirty();clearDraft()}
    if(/TEST MODE started|TEST MODE reset|Exited TEST MODE|Signed out/.test(text)){clearDirty();clearDraft()}
    if(/Backup loaded locally/.test(text))markDirty();
    if(/Sleeper Week \d+ (live|final) scores imported locally/.test(text))markDirty();
  }
  renderEnhancements();
}

app.addEventListener('input',e=>{
  if(e.target.matches?.('#weekly-bet-adjustments .actual-bet'))markDirty();
  else if(e.target.closest?.('#scores,#bets,#sleeper-map'))markDraft();
},true);
app.addEventListener('submit',e=>{if(e.target.matches?.('#scores,#bets,#sleeper-map')){clearDraft();markDirty()}},true);
app.addEventListener('change',e=>{
  if(e.target.matches?.('#week-picker')){
    const select=e.target,next=select.value,previous=draftWeekValue||lastWeekValue||next;
    if(draftDirty&&!confirm('Discard unapplied form edits and change weeks?')){
      e.preventDefault();e.stopImmediatePropagation();queueMicrotask(()=>{select.value=previous;lastWeekValue=previous});return;
    }
    if(draftDirty)clearDraft();
    lastWeekValue=next;
    return;
  }
  if(e.target.matches?.('.due-paid'))markDirty();
},true);
app.addEventListener('click',e=>{
  const target=e.target.closest?.('button,a');
  if(!target)return;
  if(target.matches('#save,#sticky-save')&&draftDirty){alert('Apply or discard the current form edits before saving.');e.preventDefault();e.stopImmediatePropagation();return}
  if(target.matches('#edit-sleeper-map'))markDirty();
  if(target.matches('#logout')&&!discardGuard('Sign out and discard unsaved or unapplied changes?')){e.preventDefault();e.stopImmediatePropagation();return}
  if(target.matches('#test-production,#test-clean')&&!discardGuard('Discard unsaved or unapplied changes and start TEST MODE?')){e.preventDefault();e.stopImmediatePropagation();return}
},true);

const observer=new MutationObserver(()=>{if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;reconcileAfterRender()})});
observer.observe(app,{childList:true,subtree:true});
reconcileAfterRender();

const app=document.querySelector('#app');
const header=document.querySelector('.site-header');
const sleeperNames=new Map();
const testModeSources=new Map();

function startTestMode(mode,dialog){
  const selector=mode==='production'?'#test-production':'#test-clean';
  const source=app.querySelector(selector)||testModeSources.get(mode);
  dialog.close();
  source?.click();
}

function ensureTestDialog(){
  let dialog=document.querySelector('#test-mode-dialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='test-mode-dialog';
  dialog.className='admin-test-dialog';
  dialog.innerHTML='<div class="admin-test-dialog-head"><strong>TEST MODE</strong><button type="button" class="ghost" data-close-test>×</button></div><p class="muted">CHOOSE A STARTING POINT.</p><div class="admin-test-dialog-actions"><button id="test-production-dialog" type="button" class="ghost">Test copy of production</button><button id="test-clean-dialog" type="button" class="ghost">Test clean league</button></div>';
  document.body.append(dialog);
  dialog.querySelector('[data-close-test]')?.addEventListener('click',()=>dialog.close());
  dialog.querySelector('#test-production-dialog')?.addEventListener('click',()=>startTestMode('production',dialog));
  dialog.querySelector('#test-clean-dialog')?.addEventListener('click',()=>startTestMode('clean',dialog));
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  return dialog;
}

function ensureHeaderTestButton(){
  if(!header)return null;
  let button=header.querySelector('#open-test-mode');
  if(!button){
    button=document.createElement('button');
    button.id='open-test-mode';
    button.type='button';
    button.className='button ghost admin-test-trigger';
    button.textContent='TEST MODE';
    button.hidden=true;
    button.addEventListener('click',()=>{
      const dialog=ensureTestDialog();
      if(!dialog.open)dialog.showModal();
    });
    header.append(button);
  }
  return button;
}

function syncTestControls(){
  const trigger=ensureHeaderTestButton();
  const productionButton=app.querySelector('#test-production');
  const cleanButton=app.querySelector('#test-clean');
  const inTestMode=document.body.classList.contains('test-mode');
  if(productionButton&&cleanButton){
    testModeSources.set('production',productionButton);
    testModeSources.set('clean',cleanButton);
    const card=productionButton.closest('.card');
    if(card){
      card.hidden=true;
      card.classList.add('admin-test-controls-source');
    }
    ensureTestDialog();
  }
  if(trigger)trigger.hidden=inTestMode||!productionButton||!cleanButton;
}

function compactActions(){
  const save=app.querySelector('#save');
  const actions=save?.closest('.actions');
  const card=actions?.closest('.card');
  if(!actions||!card)return;
  card.classList.add('admin-utility-card');
  actions.classList.add('admin-utility-actions');
}

function compactStatus(){
  const hero=app.querySelector('.hero');
  if(!hero)return;
  hero.classList.add('admin-sticky-status');
  const picker=app.querySelector('#week-picker');
  if(!picker)return;
  const pickerCard=picker.closest('.card');
  picker.setAttribute('aria-label','Week to edit');
  picker.classList.add('admin-sticky-week-picker');
  const metrics=hero.querySelectorAll('.metric');
  const editingMetric=metrics[1];
  if(!editingMetric)return;
  editingMetric.classList.add('admin-editing-metric');
  editingMetric.querySelector('strong')?.remove();
  if(picker.parentElement!==editingMetric)editingMetric.append(picker);
  pickerCard?.remove();
}

async function hydrateSleeperName(id,title){
  if(!id||!title)return;
  if(sleeperNames.has(id)){title.textContent=sleeperNames.get(id);return}
  try{
    const response=await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}`);
    if(!response.ok)return;
    const league=await response.json();
    const name=String(league?.name||'').trim();
    if(!name)return;
    sleeperNames.set(id,name);
    if(title.isConnected&&title.textContent!==name)title.textContent=name;
  }catch{}
}

function compactSleeper(){
  const eyebrow=[...app.querySelectorAll('.eyebrow')].find(el=>el.textContent.trim().toUpperCase()==='SLEEPER');
  const card=eyebrow?.closest('.card');
  if(!card||card.classList.contains('admin-sleeper-card'))return;
  const title=card.querySelector('h2');
  const idLine=[...card.querySelectorAll('p.muted')].find(el=>/\d{8,}/.test(el.textContent));
  const edit=card.querySelector('#edit-sleeper-map');
  if(!title||!idLine)return;
  const id=(idLine.textContent.match(/\d{8,}/)||[])[0]||'';
  card.classList.add('admin-sleeper-card');
  const head=document.createElement('div');
  head.className='admin-sleeper-head';
  const info=document.createElement('div');
  info.className='admin-sleeper-info';
  const identity=document.createElement('div');
  identity.className='admin-sleeper-identity';
  idLine.classList.add('admin-sleeper-id');
  const fallbackTitle=title.textContent.trim().toUpperCase()==='LEAGUE ID'?'SLEEPER LEAGUE':title.textContent;
  if(title.textContent!==fallbackTitle)title.textContent=fallbackTitle;
  identity.append(title,idLine);
  info.append(eyebrow,identity);
  head.append(info);
  if(edit){
    edit.classList.add('admin-sleeper-edit');
    head.append(edit);
    const actions=edit.closest('.actions');
    if(actions&&!actions.children.length)actions.remove();
  }
  card.prepend(head);
  hydrateSleeperName(id,title);
}

function compactScoreHeader(){
  const scores=app.querySelector('#scores');
  if(!scores)return;
  const sync=app.querySelector('#sync-sleeper');
  const applyButton=[...scores.querySelectorAll('button')].find(button=>button.type!=='button');
  if(applyButton)applyButton.classList.add('admin-apply-scores');
  if(!sync)return;
  const week=app.querySelector('#week-picker')?.value||'';
  const syncText='SYNC SCORES',syncLabel=`Sync Week ${week} scores`;
  if(sync.textContent!==syncText)sync.textContent=syncText;
  if(sync.getAttribute('aria-label')!==syncLabel)sync.setAttribute('aria-label',syncLabel);
  const card=sync.closest('.card');
  if(!card||card.classList.contains('admin-scores-card'))return;
  const eyebrow=card.querySelector('.eyebrow');
  const title=card.querySelector('h2');
  if(!eyebrow||!title)return;
  card.classList.add('admin-scores-card');
  const head=document.createElement('div');
  head.className='admin-scores-head';
  const copy=document.createElement('div');
  copy.className='admin-scores-title';
  copy.append(eyebrow,title);
  sync.classList.add('admin-sync-scores');
  head.append(copy,sync);
  card.prepend(head);
}

function compactDues(){
  const heading=[...app.querySelectorAll('h2')].find(el=>el.textContent.trim().toUpperCase()==='DUES PAYMENTS');
  const card=heading?.closest('.card');
  const history=card?.querySelector('.history');
  if(!card||!history||card.classList.contains('admin-dues-card'))return;
  card.classList.add('admin-dues-card');
  card.querySelector(':scope > p.muted')?.remove();
  const rows=[...history.querySelectorAll('.history-row')];
  if(!rows.length)return;
  const unpaid=rows.filter(row=>!row.querySelector('.due-paid')?.checked);
  const paid=rows.filter(row=>row.querySelector('.due-paid')?.checked);
  history.replaceChildren();
  const section=(label,items,className)=>{
    const wrap=document.createElement('div');
    wrap.className=`admin-dues-section ${className}`;
    const title=document.createElement('div');
    title.className='admin-dues-section-title';
    title.innerHTML=`<strong>${label}</strong><span>${items.length}</span>`;
    wrap.append(title,...items);
    return wrap;
  };
  if(unpaid.length)history.append(section('UNPAID',unpaid,'admin-dues-unpaid'));
  else{
    const clear=document.createElement('p');
    clear.className='admin-dues-clear';
    clear.textContent='ALL DUES PAID';
    history.append(clear);
  }
  if(paid.length){
    const details=document.createElement('details');
    details.className='admin-dues-paid';
    const summary=document.createElement('summary');
    summary.innerHTML=`<span>PAID</span><span class="admin-dues-paid-count">${paid.length}</span><span class="admin-dues-chevron">⌄</span>`;
    details.append(summary,...paid);
    history.append(details);
  }
}

function compactBetMeta(form){
  for(const editor of form.querySelectorAll('.bet-editor')){
    const status=editor.querySelector('select[name="parlay-status"],select[name="single-status"]')?.closest('label');
    const payout=editor.querySelector('input[name="parlay-payout"],input[name="single-payout"]')?.closest('label');
    if(!status||!payout)continue;
    status.childNodes[0].textContent='Status';
    payout.childNodes[0].textContent='Payout';
    let row=editor.querySelector(':scope > .admin-bet-meta-row');
    if(!row){row=document.createElement('div');row.className='admin-bet-meta-row';editor.insertBefore(row,status)}
    row.append(status,payout);
  }
}

function ensureLegStatusStyles(){
  if(document.querySelector('#admin-leg-status-styles'))return;
  const style=document.createElement('style');
  style.id='admin-leg-status-styles';
  style.textContent='.structured-pick-toggle.has-leg-status-pill{grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto}.structured-pick-toggle.has-leg-status-pill .structured-pick-owner{grid-column:1;grid-row:1}.structured-pick-toggle.has-leg-status-pill .admin-leg-status-pill{grid-column:2;grid-row:1;justify-self:start}.structured-pick-toggle.has-leg-status-pill .structured-pick-summary{grid-column:1/3;grid-row:2}.structured-pick-toggle.has-leg-status-pill .structured-pick-chevron{grid-column:3;grid-row:1/3}.structured-pick-toggle.has-leg-status-pill.is-empty-summary{grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-rows:auto}.structured-pick-toggle.has-leg-status-pill.is-empty-summary .admin-leg-status-pill{grid-column:2;grid-row:1}.structured-pick-toggle.has-leg-status-pill.is-empty-summary .structured-pick-summary{grid-column:3;grid-row:1}.structured-pick-toggle.has-leg-status-pill.is-empty-summary .structured-pick-chevron{grid-column:4;grid-row:1}.admin-leg-status-pill{align-self:center;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.56rem;font-weight:900;letter-spacing:.06em;line-height:1;padding:4px 7px;text-transform:uppercase;white-space:nowrap}.admin-leg-status-pill[data-status="hit"]{border-color:rgba(110,231,183,.45);background:rgba(110,231,183,.08);color:var(--accent)}.admin-leg-status-pill[data-status="miss"]{border-color:rgba(248,113,113,.48);background:rgba(248,113,113,.08);color:#f87171}.admin-leg-status-pill[data-status="push"]{border-color:rgba(251,191,36,.42);background:rgba(251,191,36,.08);color:var(--warning)}.single-structured.admin-single-collapsible.is-collapsed .structured-pick-toggle{margin:0}.single-structured.admin-single-collapsible.is-collapsed .structured-fields{display:none}@media(max-width:560px){.structured-pick-toggle.has-leg-status-pill{column-gap:7px}.admin-leg-status-pill{font-size:.52rem;padding:4px 6px}}';
  document.head.append(style);
}

function compactLegStatuses(form){
  ensureLegStatusStyles();
  for(const leg of form.querySelectorAll('.leg-editor.structured-leg')){
    const toggle=leg.querySelector('.structured-pick-toggle');
    const owner=toggle?.querySelector('.structured-pick-owner');
    const result=leg.querySelector('select[name^="legstatus-"]');
    if(!toggle||!owner||!result)continue;
    let pill=toggle.querySelector('.admin-leg-status-pill');
    if(!pill){
      pill=document.createElement('span');
      pill.className='admin-leg-status-pill';
      owner.insertAdjacentElement('afterend',pill);
      toggle.classList.add('has-leg-status-pill');
    }
    const sync=()=>{
      const status=String(result.value||'pending').toLowerCase();
      pill.textContent=status;
      pill.dataset.status=status;
      pill.setAttribute('aria-label',`Leg result: ${status}`);
    };
    if(!result.dataset.summaryStatusWired){
      result.dataset.summaryStatusWired='1';
      result.addEventListener('change',sync);
    }
    sync();
  }
}

function compactSingleBet(form){
  ensureLegStatusStyles();
  const wrap=form.querySelector('.single-structured');
  const source=form.querySelector('textarea[name="single-desc"]');
  if(!wrap||!source||wrap.dataset.collapsible)return;
  wrap.dataset.collapsible='1';
  wrap.classList.add('admin-single-collapsible');
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='structured-pick-toggle';
  toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML='<span class="structured-pick-owner structured-pick-title">$5 BET</span><span class="structured-pick-summary"></span><span class="structured-pick-chevron" aria-hidden="true">⌄</span>';
  wrap.prepend(toggle);
  const summary=toggle.querySelector('.structured-pick-summary');
  const sync=()=>{
    const value=String(source.value||'').trim();
    summary.textContent=value||'No bet selected';
    toggle.classList.toggle('is-empty-summary',!value);
  };
  const setCollapsed=collapsed=>{
    wrap.classList.toggle('is-collapsed',collapsed);
    toggle.setAttribute('aria-expanded',String(!collapsed));
  };
  wrap.addEventListener('input',sync);
  wrap.addEventListener('change',sync);
  toggle.addEventListener('click',()=>setCollapsed(!wrap.classList.contains('is-collapsed')));
  sync();
  setCollapsed(true);
}

function compactBetCopy(){
  const form=app.querySelector('#bets');
  const card=form?.closest('.card');
  if(!card)return;
  const parlayEyebrow=[...card.querySelectorAll('.eyebrow')].find(el=>el.textContent.toUpperCase().includes('$10 PARLAY'));
  const parlayNote=parlayEyebrow?.nextElementSibling;
  if(parlayNote?.matches('p.muted'))parlayNote.remove();
  const bettingOnly=[...card.querySelectorAll(':scope > p.muted')].find(p=>p.textContent.includes('Betting-only period'));
  if(bettingOnly)bettingOnly.textContent='BETTING ONLY — NO SCORES OR DUES.';
  compactBetMeta(form);
  compactLegStatuses(form);
  compactSingleBet(form);

  const saveLegs=card.querySelector('#save-leg-results');
  if(saveLegs){
    saveLegs.classList.remove('ghost');
    saveLegs.classList.add('admin-apply-scores');
  }
  const applyBets=[...form.querySelectorAll(':scope > button')].find(button=>button.type!=='button');
  if(applyBets)applyBets.classList.add('admin-apply-scores');
}

function movePublicView(){
  header?.querySelector('a[href="../"]')?.classList.add('admin-header-public-hidden');
  if(!window.__fantasyAdmin?.isAuthenticated?.()||app.querySelector('.admin-public-footer'))return;
  app.insertAdjacentHTML('beforeend','<div class="admin-public-footer"><a class="button ghost" href="../">PUBLIC VIEW</a></div>');
}

function apply(){compactStatus();compactActions();syncTestControls();compactSleeper();compactScoreHeader();compactDues();compactBetCopy();movePublicView()}
window.addEventListener('fantasy-admin-rendered',apply);
apply();
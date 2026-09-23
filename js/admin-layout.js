const app=document.querySelector('#app');
const header=document.querySelector('.site-header');
const sleeperNames=new Map();

function ensureTestDialog(){
  let dialog=document.querySelector('#test-mode-dialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='test-mode-dialog';
  dialog.className='admin-test-dialog';
  dialog.innerHTML='<div class="admin-test-dialog-head"><strong>TEST MODE</strong><button type="button" class="ghost" data-close-test>×</button></div><p class="muted">CHOOSE A STARTING POINT.</p><div class="admin-test-dialog-actions"></div>';
  document.body.append(dialog);
  dialog.querySelector('[data-close-test]')?.addEventListener('click',()=>dialog.close());
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
    button.addEventListener('click',()=>document.querySelector('#test-mode-dialog')?.showModal());
    header.append(button);
  }
  return button;
}

function moveTestControls(){
  const trigger=ensureHeaderTestButton();
  const productionButton=app.querySelector('#test-production');
  const cleanButton=app.querySelector('#test-clean');
  const inTestMode=document.body.classList.contains('test-mode');
  if(trigger)trigger.hidden=inTestMode;
  if(!productionButton||!cleanButton)return;
  const card=productionButton.closest('.card');
  const actions=productionButton.closest('.actions');
  const dialog=ensureTestDialog();
  const target=dialog.querySelector('.admin-test-dialog-actions');
  target.replaceChildren();
  target.append(productionButton,cleanButton);
  productionButton.classList.add('ghost');
  cleanButton.classList.add('ghost');
  productionButton.addEventListener('click',()=>dialog.close(),{once:true});
  cleanButton.addEventListener('click',()=>dialog.close(),{once:true});
  actions?.remove();
  card?.remove();
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

function movePublicView(){
  header?.querySelector('a[href="../"]')?.classList.add('admin-header-public-hidden');
  if(!window.__fantasyAdmin?.isAuthenticated?.()||app.querySelector('.admin-public-footer'))return;
  app.insertAdjacentHTML('beforeend','<div class="admin-public-footer"><a class="button ghost" href="../">PUBLIC VIEW</a></div>');
}

function apply(){compactStatus();compactActions();moveTestControls();compactSleeper();compactScoreHeader();compactDues();movePublicView()}
window.addEventListener('fantasy-admin-rendered',apply);
apply();

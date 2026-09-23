const app=document.querySelector('#app');
const header=document.querySelector('.site-header');
let queued=false;

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
  if(hero)hero.classList.add('admin-sticky-status');
}

function movePublicView(){
  header?.querySelector('a[href="../"]')?.classList.add('admin-header-public-hidden');
  if(!window.__fantasyAdmin?.isAuthenticated?.()||app.querySelector('.admin-public-footer'))return;
  app.insertAdjacentHTML('beforeend','<div class="admin-public-footer"><a class="button ghost" href="../">PUBLIC VIEW</a></div>');
}

function apply(){
  compactStatus();
  compactActions();
  moveTestControls();
  movePublicView();
}

const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;apply()});
});
observer.observe(app,{childList:true,subtree:true});
apply();

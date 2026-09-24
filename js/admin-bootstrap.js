const app=document.querySelector('#app');
const RECOVERY_VERSION='20260923-testmode-isolation1';
const TEST_MODE_KEY='bh_test_mode',TEST_DATA_KEY='bh_test_data',TEST_SEED_KEY='bh_test_seed';
const RECOVERED_KEY='bh_admin_recovered_test_mode';
const ADMIN_RENDER_EVENT='fantasy-admin-rendered';
const ENHANCEMENT_SELECTOR='#weekly-bet-adjustments,#weekly-closeout,#save-dock,.admin-public-footer';
let renderSignalQueued=false;

function clearTestMode(){
  localStorage.removeItem(TEST_MODE_KEY);
  localStorage.removeItem(TEST_DATA_KEY);
  localStorage.removeItem(TEST_SEED_KEY);
}
function validJsonObject(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||'null');
    return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  }catch{return false}
}
function recoverObviouslyBrokenTestMode(){
  if(localStorage.getItem(TEST_MODE_KEY)!=='1')return false;
  if(validJsonObject(TEST_DATA_KEY)&&validJsonObject(TEST_SEED_KEY))return false;
  clearTestMode();
  sessionStorage.setItem(RECOVERED_KEY,'1');
  return true;
}
function showFatal(error){
  console.error('Admin startup failed.',error);
  const message=String(error?.message||error||'Unknown startup error.');
  const inTestMode=localStorage.getItem(TEST_MODE_KEY)==='1';
  app.innerHTML=`<section class="card error"><p class="eyebrow">Admin startup error</p><h2>Admin failed to start</h2><p>${message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</p><div class="actions">${inTestMode?'<button id="recover-test-mode" type="button">Discard TEST MODE data & reload production</button>':''}<button id="reload-admin" type="button" class="ghost">Reload admin</button></div></section>`;
  document.querySelector('#recover-test-mode')?.addEventListener('click',()=>{clearTestMode();location.reload()});
  document.querySelector('#reload-admin')?.addEventListener('click',()=>location.reload());
}
function enhancementOnlyMutation(mutation){
  const nodes=[...mutation.addedNodes,...mutation.removedNodes].filter(node=>node.nodeType===Node.ELEMENT_NODE);
  return nodes.length>0&&nodes.every(node=>node.matches?.(ENHANCEMENT_SELECTOR));
}
function signalAdminRendered(){
  if(renderSignalQueued)return;
  renderSignalQueued=true;
  setTimeout(()=>{
    renderSignalQueued=false;
    window.dispatchEvent(new Event(ADMIN_RENDER_EVENT));
  },0);
}

// One coordinator observes core #app replacement. Companion modules listen for the render event
// instead of creating their own MutationObservers. Enhancement-only top-level mutations are ignored
// so post-render DOM work cannot recursively schedule itself.
new MutationObserver(mutations=>{
  if(mutations.every(enhancementOnlyMutation))return;
  signalAdminRendered();
}).observe(app,{childList:true});

recoverObviouslyBrokenTestMode();
try{
  await import(`./admin.js?v=${RECOVERY_VERSION}`);
  if(sessionStorage.getItem(RECOVERED_KEY)==='1'){
    sessionStorage.removeItem(RECOVERED_KEY);
    app.insertAdjacentHTML('afterbegin','<section class="card error"><strong>Broken TEST MODE data was discarded. Production data reloaded.</strong></section>');
  }
}catch(error){
  if(localStorage.getItem(TEST_MODE_KEY)==='1'&&sessionStorage.getItem(RECOVERED_KEY)!=='1'){
    clearTestMode();
    sessionStorage.setItem(RECOVERED_KEY,'1');
    location.reload();
  }else showFatal(error);
}

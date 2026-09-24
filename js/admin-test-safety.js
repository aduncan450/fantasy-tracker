const app=document.querySelector('#app');
const TEST_MODE_KEY='bh_test_mode';
const TEST_DATA_KEY='bh_test_data';
const TEST_SEED_KEY='bh_test_seed';

function validJsonObject(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||'null');
    return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  }catch{return false}
}

function guardTestModeSave(event){
  const target=event.target.closest?.('#save,#save-leg-results');
  if(!target||!document.body.classList.contains('test-mode'))return;

  if(!validJsonObject(TEST_DATA_KEY)||!validJsonObject(TEST_SEED_KEY)){
    event.preventDefault();
    event.stopImmediatePropagation();
    alert('TEST MODE storage is incomplete. Reload the admin portal before saving. Production was not changed.');
    return;
  }

  // TEST MODE is a fail-closed boundary. If the visible admin state is still TEST MODE
  // but the localStorage flag was lost during a render race, restore the flag before any
  // save handler can decide between browser storage and production Supabase.
  if(localStorage.getItem(TEST_MODE_KEY)!=='1')localStorage.setItem(TEST_MODE_KEY,'1');
}

app.addEventListener('click',guardTestModeSave,true);

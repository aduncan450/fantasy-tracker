import * as storage from './storage.js?v=20260923-compact-parlay1';

const TEST_MODE_KEY='bh_test_mode';
const TEST_DATA_KEY='bh_test_data';
const TEST_SEED_KEY='bh_test_seed';

export const loadAdminLeague=storage.loadAdminLeague;
export const signIn=storage.signIn;
export const captureSessionFromHash=storage.captureSessionFromHash;
export const signOut=storage.signOut;
export const isTestMode=storage.isTestMode;
export const enterTestMode=storage.enterTestMode;
export const resetTestMode=storage.resetTestMode;
export const exitTestMode=storage.exitTestMode;

function hasTestModeData(){
  return localStorage.getItem(TEST_DATA_KEY)!==null&&localStorage.getItem(TEST_SEED_KEY)!==null;
}

export async function saveAdminLeague(data,accessToken){
  // Fail closed: while a disposable TEST MODE dataset still exists, admin saves
  // must stay browser-local even if the mode marker or body class races a rerender.
  if(!storage.isTestMode()&&hasTestModeData())localStorage.setItem(TEST_MODE_KEY,'1');
  return storage.saveAdminLeague(data,accessToken);
}

import * as storage from './storage.js?v=20260923-compact-parlay1';

const TEST_MODE_KEY='bh_test_mode';

export const loadAdminLeague=storage.loadAdminLeague;
export const signIn=storage.signIn;
export const captureSessionFromHash=storage.captureSessionFromHash;
export const signOut=storage.signOut;
export const isTestMode=storage.isTestMode;
export const enterTestMode=storage.enterTestMode;
export const resetTestMode=storage.resetTestMode;
export const exitTestMode=storage.exitTestMode;

export async function saveAdminLeague(data,accessToken){
  const visibleTestMode=storage.isTestMode()||document.body.classList.contains('test-mode');
  if(visibleTestMode&&!storage.isTestMode())localStorage.setItem(TEST_MODE_KEY,'1');
  return storage.saveAdminLeague(data,accessToken);
}

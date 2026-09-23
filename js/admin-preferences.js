// Compatibility shim for stale cached admin shells that still reference this file.
// The former DOM-rewriting observer could loop against admin-qol.js and freeze the portal.
const RECOVERY_VERSION='20260923-admin-recovery1';
const url=new URL(location.href);
if(url.searchParams.get('adminRecovery')!==RECOVERY_VERSION){
  url.searchParams.set('adminRecovery',RECOVERY_VERSION);
  location.replace(url);
}

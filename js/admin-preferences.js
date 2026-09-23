const app=document.querySelector('#app');
const players=['Duncan','Jacob','Matt','Weston'];
const replacements=[
  [/^The configured league loads automatically\./,'SLEEPER SCORE SYNC.'],
  [/^The workflow week can advance automatically,/,'JUMP TO ANY WEEK.'],
  [/^Mark each weekly charge paid individually\./,'MARK DUES PAID BY WEEK.'],
  [/^Update individual leg results as they settle\./,'SETTLE LEGS AS RESULTS COME IN.'],
  [/^Run the real admin UI against isolated browser-only test data\./,'ISOLATED BROWSER DATA FOR QA.'],
  [/^← marks the workflow week,/,'← CURRENT · • NEEDS ATTENTION · ✓ CLEAR.'],
  [/^All earlier started weeks are clear\. This status is derived from tracker data and is never stored separately\.$/,'ALL EARLIER WEEKS CLEAR.'],
  [/^\d+ older weeks? needs? attention\. This status is derived from tracker data and is never stored separately\.$/,'OLDER WEEKS NEED ATTENTION.']
];
function tightenCopy(){
  for(const p of app.querySelectorAll('p.muted')){
    const text=p.textContent.trim();
    for(const [pattern,replacement] of replacements){
      if(pattern.test(text)){p.textContent=replacement;break}
    }
  }
}
function preserveFantasyNames(){
  const walker=document.createTreeWalker(app,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;
    if(!parent||parent.closest('.fantasy-player-name')||parent.matches('script,style,option,textarea'))return NodeFilter.FILTER_REJECT;
    return players.some(p=>node.nodeValue.includes(p))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const parts=node.nodeValue.split(new RegExp(`(${players.join('|')})`,'g'));
    if(parts.length<2)continue;
    const frag=document.createDocumentFragment();
    for(const part of parts){
      if(players.includes(part)){const span=document.createElement('span');span.className='fantasy-player-name';span.textContent=part;frag.append(span)}else frag.append(document.createTextNode(part));
    }
    node.replaceWith(frag);
  }
}
function apply(){tightenCopy();preserveFantasyNames()}
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}).observe(app,{childList:true,subtree:true});apply();

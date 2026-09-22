const ESPN_BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const PERSON_SUFFIXES=new Set(['jr','sr','ii','iii','iv','v']);

const clean=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const personParts=s=>{const parts=clean(s).split(' ').filter(Boolean);while(parts.length&&PERSON_SUFFIXES.has(parts.at(-1)))parts.pop();return parts};
const numberValue=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};

function statKey(category,key,label){const k=clean(key).replace(/ /g,''),c=clean(category),l=clean(label);
  if(k==='rushingyards'||(c==='rushing'&&l==='yds'))return 'rushingYards';
  if(k==='rushingtouchdowns'||(c==='rushing'&&l==='td'))return 'rushingTouchdowns';
  if(k==='receivingyards'||(c==='receiving'&&l==='yds'))return 'receivingYards';
  if(k==='receivingtouchdowns'||(c==='receiving'&&l==='td'))return 'receivingTouchdowns';
  if(k==='receptions'||(c==='receiving'&&l==='rec'))return 'receptions';
  if(k==='passingyards'||(c==='passing'&&l==='yds'))return 'passingYards';
  if(k==='passingtouchdowns'||(c==='passing'&&l==='td'))return 'passingTouchdowns';
  return null;
}

function playerAliases(athlete){return [athlete?.displayName,athlete?.fullName,athlete?.shortName,athlete?.name].filter(Boolean)}
function teamAliases(team){return [team?.displayName,team?.shortDisplayName,team?.name,team?.abbreviation,team?.location,team?.location&&team?.name?`${team.location} ${team.name}`:null].filter(Boolean)}

export function playerNameMatches(query,aliases=[]){const q=personParts(query);if(!q.length)return false;return aliases.some(alias=>{const a=personParts(alias);if(!a.length)return false;if(q.join(' ')===a.join(' '))return true;if(q.length<2||a.length<2)return false;const qFirst=q[0],aFirst=a[0],qSurname=q.slice(1).join(' '),aSurname=a.slice(-(q.length-1)).join(' ');return qSurname===aSurname&&(qFirst===aFirst||(qFirst.length===1&&aFirst.startsWith(qFirst)));});}
export function teamNameMatches(query,aliases=[]){const q=clean(query);if(!q)return false;return aliases.some(alias=>{const a=clean(alias);return q===a||a.split(' ').includes(q)||(q.includes(' ')&&a.endsWith(q));});}

export function parseBetPick(text){const raw=String(text??'').trim();if(!raw)return {supported:false,raw,reason:'Empty bet description.'};
  const total=raw.match(/^(.+?)\s+(?:vs\.?|versus|at)\s+(.+?)\s+(over|under)\s+(\d*\.?\d+)\s+(?:total|game total)$/i);
  if(total)return {supported:true,kind:'team-total',raw,team:total[1].trim(),opponent:total[2].trim(),direction:total[3].toLowerCase(),line:Number(total[4])};
  const spread=raw.match(/^(.+?)\s+([+-]?\d*\.?\d+)\s+(?:spread|ats)$/i);
  if(spread)return {supported:true,kind:'team-spread',raw,team:spread[1].trim(),line:Number(spread[2])};
  const player=raw.match(/^(.+?)\s+(over|under)\s+(-?\d*\.?\d+)\s+(.+)$/i);
  if(player){const subject=player[1].trim(),direction=player[2].toLowerCase(),line=Number(player[3]),prop=clean(player[4]);let stat=null,label=null;
    const defs=[
      [/^rushing yards?$/, 'rushingYards','rushing yards'],
      [/^receiving yards?$/, 'receivingYards','receiving yards'],
      [/^receptions?$/, 'receptions','receptions'],
      [/^passing yards?$/, 'passingYards','passing yards'],
      [/^rushing (?:tds?|touchdowns?)$/, 'rushingTouchdowns','rushing touchdowns'],
      [/^receiving (?:tds?|touchdowns?)$/, 'receivingTouchdowns','receiving touchdowns'],
      [/^passing (?:tds?|touchdowns?)$/, 'passingTouchdowns','passing touchdowns'],
      [/^(?:anytime )?(?:tds?|touchdowns?)$/, 'anytimeTouchdowns','anytime touchdowns']
    ];
    for(const [re,key,name] of defs)if(re.test(prop)){stat=key;label=name;break}
    if(!stat)return {supported:false,raw,reason:`Unsupported player prop: ${player[4].trim()}`};
    return {supported:true,kind:'player-prop',raw,subject,direction,line,stat,statLabel:label};
  }
  const team=raw.match(/^(.+?)\s+(?:to\s+win|moneyline|ml)(?:\s+(?:vs\.?|versus|at)\s+(.+))?$/i);
  if(team)return {supported:true,kind:'team-win',raw,team:team[1].trim(),opponent:team[2]?.trim()||null};
  return {supported:false,raw,reason:'Description format is not supported yet.'};
}

export function normalizeEspnScoreboard(payload){return (payload?.events||[]).map(event=>{const competition=event?.competitions?.[0]||{},status=competition?.status?.type||event?.status?.type||{};return {id:String(event?.id||competition?.id||''),name:event?.name||event?.shortName||`Event ${event?.id||''}`,completed:Boolean(status.completed),statusName:status.shortDetail||status.detail||status.description||status.name||'',teams:(competition?.competitors||[]).map(c=>({aliases:teamAliases(c.team),score:numberValue(c.score),winner:c.winner===true})),players:[]};}).filter(e=>e.id)}

export function mergeEspnSummary(event,summary){const byId=new Map();for(const teamBlock of summary?.boxscore?.players||[]){for(const category of teamBlock?.statistics||[]){const keys=category?.keys||[],labels=category?.labels||[];for(const row of category?.athletes||[]){const athlete=row?.athlete||{},id=String(athlete.id||athlete.uid||athlete.displayName||athlete.fullName||'');if(!id)continue;let p=byId.get(id);if(!p){p={aliases:playerAliases(athlete),stats:{}};byId.set(id,p)}const values=row?.stats||[];for(let i=0;i<values.length;i++){const canonical=statKey(category?.name,keys[i],labels[i]);if(!canonical)continue;const value=numberValue(values[i]);if(value!==null)p.stats[canonical]=value;}}}}
  event.players=[...byId.values()];return event;
}

async function fetchJson(url,fetchImpl){const r=await fetchImpl(url,{cache:'no-store'});if(!r?.ok)throw new Error(`NFL result source returned ${r?.status||'an error'}.`);return r.json()}
export async function fetchNflWeekSnapshot(season,week,fetchImpl=fetch){const scoreboard=await fetchJson(`${ESPN_BASE}/scoreboard?dates=${encodeURIComponent(season)}&seasontype=2&week=${encodeURIComponent(week)}`,fetchImpl),events=normalizeEspnScoreboard(scoreboard);await Promise.all(events.map(async event=>{try{const summary=await fetchJson(`${ESPN_BASE}/summary?event=${encodeURIComponent(event.id)}`,fetchImpl);mergeEspnSummary(event,summary)}catch(error){event.summaryError=error.message}}));return {season:Number(season),week:Number(week),events};}

function findPlayer(snapshot,subject){const matches=[];for(const event of snapshot.events||[])for(const player of event.players||[])if(playerNameMatches(subject,player.aliases))matches.push({event,player});return matches.length===1?matches[0]:matches.length>1?{ambiguous:true,matches}:null}
function findTeamEvent(snapshot,team,opponent){const matches=[];for(const event of snapshot.events||[]){const mine=event.teams?.find(t=>teamNameMatches(team,t.aliases));if(!mine)continue;if(opponent&&!event.teams?.some(t=>t!==mine&&teamNameMatches(opponent,t.aliases)))continue;matches.push({event,team:mine});}return matches.length===1?matches[0]:matches.length>1?{ambiguous:true,matches}:null}
function statValue(player,stat){if(stat==='anytimeTouchdowns')return Number(player.stats?.rushingTouchdowns||0)+Number(player.stats?.receivingTouchdowns||0);const v=player.stats?.[stat];return Number.isFinite(Number(v))?Number(v):null}
function compare(direction,actual,line){if(actual===line)return 'push';return direction==='over'?(actual>line?'hit':'miss'):(actual<line?'hit':'miss')}
function teamResult(parsed,snapshot){const found=findTeamEvent(snapshot,parsed.team,parsed.opponent);if(!found)return {supported:true,settled:false,status:'placed',evidence:`Could not uniquely match ${parsed.team}${parsed.opponent?` vs ${parsed.opponent}`:''} to this NFL week.`};if(found.ambiguous)return {supported:true,settled:false,status:'placed',evidence:'Matched more than one NFL game; no result applied.'};const {event,team}=found;if(!event.completed)return {supported:true,settled:false,status:'placed',evidence:`${event.name} is not final (${event.statusName||'in progress'}).`};const other=event.teams.find(t=>t!==team);if(team.score===null||other?.score===null)return {supported:true,settled:false,status:'placed',evidence:`${event.name} is final, but the score is unavailable.`};if(parsed.kind==='team-win'){let status;if(team.score===other.score)status='push';else status=team.winner?'won':'lost';return {supported:true,settled:true,status,evidence:`${event.name}: ${team.score}-${other.score} · FINAL`};}if(parsed.kind==='team-spread'){const adjusted=team.score+parsed.line,status=adjusted===other.score?'push':adjusted>other.score?'won':'lost';return {supported:true,settled:true,status,evidence:`${event.name}: ${team.score}-${other.score} · ${parsed.team} ${parsed.line>=0?'+':''}${parsed.line} · FINAL`};}const total=team.score+other.score,status=total===parsed.line?'push':parsed.direction==='over'?(total>parsed.line?'won':'lost'):(total<parsed.line?'won':'lost');return {supported:true,settled:true,status,evidence:`${event.name}: ${team.score}-${other.score} · total ${total} vs ${parsed.direction} ${parsed.line} · FINAL`};}

export function evaluateBetPick(parsed,snapshot){if(!parsed?.supported)return {supported:false,settled:false,status:null,evidence:parsed?.reason||'Unsupported bet.'};
  if(['team-win','team-spread','team-total'].includes(parsed.kind))return teamResult(parsed,snapshot);
  const found=findPlayer(snapshot,parsed.subject);if(!found)return {supported:true,settled:false,status:'pending',evidence:`Could not uniquely match ${parsed.subject} to an ESPN box score for this week.`};if(found.ambiguous)return {supported:true,settled:false,status:'pending',evidence:`Matched ${parsed.subject} to more than one player; no result applied.`};const {event,player}=found;if(!event.completed)return {supported:true,settled:false,status:'pending',evidence:`${parsed.subject}'s game is not final (${event.statusName||'in progress'}).`};const actual=statValue(player,parsed.stat);if(actual===null)return {supported:true,settled:false,status:'pending',evidence:`${parsed.subject} was found, but ${parsed.statLabel} was unavailable.`};const status=compare(parsed.direction,actual,parsed.line);const displayName=player.aliases?.[0]||parsed.subject;return {supported:true,settled:true,status,evidence:`${displayName}: ${actual} ${parsed.statLabel} vs ${parsed.direction} ${parsed.line} · FINAL`};}

export async function detectBetResults({season,week,parlayLegs=[],singleDescription='',fetchImpl=fetch,snapshot=null}){const data=snapshot||await fetchNflWeekSnapshot(season,week,fetchImpl);const legs=parlayLegs.map(leg=>{const parsed=parseBetPick(leg.pick);return {...leg,parsed,result:evaluateBetPick(parsed,data)}});const singleParsed=parseBetPick(singleDescription),single=singleDescription?{description:singleDescription,parsed:singleParsed,result:evaluateBetPick(singleParsed,data)}:null;return {snapshot:data,legs,single};}

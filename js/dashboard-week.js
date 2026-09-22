const CENTRAL_TIME_ZONE='America/Chicago';
const DAY_MS=86400000;

function seasonStartYear(data){
  const text=`${data?.season?.label||''} ${data?.id||''}`;
  const match=text.match(/\b(20\d{2})\b/);
  return match?Number(match[1]):null;
}

function centralDateParts(now){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:CENTRAL_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}

function ordinal({year,month,day}){
  return Math.floor(Date.UTC(year,month-1,day)/DAY_MS);
}

function weekOneThursday(year){
  const septemberNinth=new Date(Date.UTC(year,8,9));
  const daysUntilThursday=(4-septemberNinth.getUTCDay()+7)%7;
  return {year,month:9,day:9+daysUntilThursday};
}

export function dashboardWeek(data,now=new Date()){
  const year=seasonStartYear(data);
  if(!year)return 1;
  const elapsedDays=ordinal(centralDateParts(now))-ordinal(weekOneThursday(year));
  if(elapsedDays<0)return 1;
  return Math.min(17,Math.floor(elapsedDays/7)+1);
}

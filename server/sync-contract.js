// Three-way merge contract used by the Notion synchronization worker.
// All arguments are normalized A:F task records. Never silently resolve conflicts.
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reconcileTask(local,remote,baseline){
 local=local.slice(0,6);remote=remote.slice(0,6);baseline=baseline?.slice(0,6);
 if(local[3]==='Отложено'&&remote[3]==='Не начато')remote[3]='Отложено';
 if(!baseline||baseline.every(v=>!v))return same(local,remote)?{action:'agree',value:local}:{action:'conflict',local,remote,baseline};
 const l=!same(local,baseline),r=!same(remote,baseline);
 if(same(local,remote))return {action:'agree',value:local};
 if(l&&!r)return {action:'push_notion',value:local};
 if(r&&!l)return {action:'pull_notion',value:remote};
 if(!l&&!r)return {action:'agree',value:local};
 return {action:'conflict',local,remote,baseline};
}
export function normalizeNotion(row){return [row.title||'',row.project||'',({'Критический':'Высокий','Высокий':'Высокий','Обычный':'Средний','Низкий':'Низкий'})[row.priority]||'Средний',({'Not started':'Не начато','In progress':'В работе','Done':'Готово'})[row.status]||'Не начато',row.due||'',row.nextAction||''];}
export function updateCalendarSnapshot(existing,remote,from,to){
 const header=existing[0]||[];const stable=existing.slice(1).filter(r=>r[11]!=='Google Calendar'||r[0]<from||r[0]>to);
 const byId=new Map();for(const row of stable.concat(remote)){const key=row[9]||JSON.stringify(row);byId.set(key,row);}
 return [header,...[...byId.values()].sort((a,b)=>(a[0]+' '+a[2]).localeCompare(b[0]+' '+b[2]))];
}

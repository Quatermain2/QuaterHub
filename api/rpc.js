import {sb,authenticated,guard,reply} from '../server/http.js';
import {runtime} from '../server/adapter.js';
import {validateMarketing} from '../server/marketing-schema.js';
const reads=new Set(['getDashboardData','refreshCalendarAndGetDashboardData','getAiLabData','getContentPlanData','getMarketingData','getTables']);
const writes=new Set(['saveDaily','saveTask','setTaskStatus','saveProjectEvent','saveMarketingData','saveTableRow']);
export default async function handler(req,res){try{
 guard(req);const {token}=await authenticated(req,res);const {name,args=[],revision}=req.body||{};
 if(!reads.has(name)&&!writes.has(name))throw Error('Неизвестное действие');
 const rows=await sb('/rest/v1/shtab_workspaces?select=id,data,version&limit=1',token);if(!rows.length)throw Object.assign(Error('Нет доступа'),{status:403});
 const row=rows[0],data=row.data;
 if(writes.has(name)&&revision!==row.version)throw Object.assign(Error('Данные изменились в другом окне. Обновите страницу и повторите действие.'),{status:409});
 let value;
 if(name==='getMarketingData')value={state:data.marketing,version:row.version};
 else if(name==='saveMarketingData'){data.marketing=validateMarketing(args[0]?.state);value={version:row.version+1};}
 else if(name==='getTables')value=data.tables;
 else if(name==='saveTableRow'){
  const p=args[0];if(!Object.hasOwn(data.tables,p?.table)||!Number.isInteger(p.row)||p.row<1||p.row>data.tables[p.table].length+1||!Array.isArray(p.values)||p.values.length>26||p.values.some(x=>typeof x!=='string'||x.length>20000))throw Error('Некорректная строка');
  data.tables[p.table][p.row-1]=p.values;value={ok:true};
 }else {const core=runtime(data.tables,data.richLinks);value=core[name](...args);}
 let version=row.version;
 if(writes.has(name)){
  const result=await sb('/rest/v1/rpc/shtab_save_workspace',token,{method:'POST',body:JSON.stringify({workspace:row.id,expected:row.version,payload:data})});
  if(!result.length)throw Object.assign(Error('Конфликт сохранения. Обновите страницу.'),{status:409});version=result[0].version;
 }
 reply(res,200,{value,revision:version});
 }catch(e){reply(res,e.status||400,{error:e.message});}}

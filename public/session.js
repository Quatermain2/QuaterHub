window.shtabRevision=null;
const shtabVersions={};
const shtabScopes={getAiLabData:'lab',saveProjectEvent:'lab',getMarketingData:'marketing',saveMarketingData:'marketing',getTables:'tables',saveTableRow:'tables',getContentPlanData:'smm'};
window.shtabCall=async function(name,...args){
 const scope=shtabScopes[name]||'dashboard';
 const revision=name==='saveMarketingData'?args[0]?.version:shtabVersions[scope];
 const body={name,args,revision};
 const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const b=await r.json();if(r.status===401){location.href='/';throw Error('Войдите в штаб');}if(!r.ok)throw Error(b.error||'Ошибка сохранения');
 shtabVersions[scope]=b.revision;window.shtabRevision=b.revision;return b.value;
};
fetch('/api/auth').then(async r=>{if(!r.ok)location.replace('/');});

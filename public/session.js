window.shtabRevision=null;
// Restore cookies before starting data requests, avoiding parallel token refreshes.
const shtabSessionReady=fetch('/api/auth',{cache:'no-store'}).then(r=>{
 if(r.status===401)location.replace('/');
}).catch(()=>{}); // A network outage is not a sign-out.
const shtabVersions={};
const shtabScopes={getAiLabData:'lab',saveProjectEvent:'lab',getMarketingData:'marketing',saveMarketingData:'marketing',getTables:'tables',saveTableRow:'tables',getContentPlanData:'smm'};
window.shtabCall=async function(name,...args){
 await shtabSessionReady;
 const scope=shtabScopes[name]||'dashboard';
 const revision=name==='saveMarketingData'?args[0]?.version:shtabVersions[scope];
 const body={name,args,revision};
 const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const b=await r.json();if(r.status===401){location.href='/';throw Error('Войдите в штаб');}if(!r.ok)throw Error(b.error||'Ошибка сохранения');
 shtabVersions[scope]=b.revision;window.shtabRevision=b.revision;return b.value;
};

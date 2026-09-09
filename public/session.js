window.shtabRevision=null;
window.shtabCall=async function(name,...args){
 const body={name,args,revision:window.shtabRevision};
 const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const b=await r.json();if(r.status===401){location.href='/';throw Error('Войдите в штаб');}if(!r.ok)throw Error(b.error||'Ошибка сохранения');
 window.shtabRevision=b.revision;return b.value;
};
fetch('/api/auth').then(async r=>{if(!r.ok)location.replace('/');});

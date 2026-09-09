import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
export async function sb(path,token,options={}){
 if(!SUPABASE_URL||!SUPABASE_KEY)throw Object.assign(Error('Отдельная база штаба ещё не подключена'),{status:503});
 const r=await fetch(SUPABASE_URL+path,{...options,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...options.headers},signal:AbortSignal.timeout(18000)});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={message:text}}
 if(!r.ok)throw Object.assign(Error(data.msg||data.message||data.error_description||'Сервис временно недоступен'),{status:r.status});return data;
}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)));}
export function setSession(res,s){const secure=process.env.VERCEL?' Secure;':'';res.setHeader('Set-Cookie',[
 `shtab_access=${s.access_token||''}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${s.expires_in||0}`,
 `shtab_refresh=${s.refresh_token||''}; HttpOnly;${secure} SameSite=Lax; Path=/api; Max-Age=${s.refresh_token?2592000:0}`]);}
export async function authenticated(req,res){
 const c=cookies(req);let token=c.shtab_access;
 if(token){try{const user=await sb('/auth/v1/user',token);if(!user.email_confirmed_at)throw Error('Подтвердите почту');return {token,user};}catch(e){if(e.status!==401&&e.status!==403)throw e;}}
 if(c.shtab_refresh){const s=await sb('/auth/v1/token?grant_type=refresh_token',null,{method:'POST',body:JSON.stringify({refresh_token:c.shtab_refresh})});if(!s.user?.email_confirmed_at)throw Error('Подтвердите почту');setSession(res,s);return {token:s.access_token,user:s.user};}
 throw Object.assign(Error('Войдите в штаб'),{status:401});
}
export function guard(req){if(req.method!=='POST')throw Object.assign(Error('Метод не поддерживается'),{status:405});const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw Object.assign(Error('Запрос отклонён'),{status:403});if(Buffer.byteLength(JSON.stringify(req.body||{}))>1500000)throw Object.assign(Error('Слишком большой запрос'),{status:413});}
export function reply(res,status,data){res.setHeader('Cache-Control','private, no-store');res.status(status).json(data);}

import {sb,authenticated,setSession,guard,reply} from '../server/http.js';
export default async function handler(req,res){try{
 if(req.method==='GET'){const {token,user}=await authenticated(req,res);const rows=await sb('/rest/v1/shtab_workspaces?select=id&limit=1',token);if(!rows.length)throw Object.assign(Error('У этого аккаунта нет доступа к штабу'),{status:403});return reply(res,200,{email:user.email});}
 guard(req);const {action,email,password}=req.body||{};
 if(action==='logout'){setSession(res,{});return reply(res,200,{ok:true});}
 if(typeof email!=='string'||typeof password!=='string'||password.length<12||password.length>128)throw Error('Укажите почту и пароль от 12 до 128 символов');
 if(action==='signup'){await sb('/auth/v1/signup',null,{method:'POST',body:JSON.stringify({email,password})});return reply(res,200,{message:'Подтвердите почту по письму и вернитесь сюда для входа.'});}
 if(action!=='login')throw Error('Неизвестное действие');
 const s=await sb('/auth/v1/token?grant_type=password',null,{method:'POST',body:JSON.stringify({email,password})});
 const rows=await sb('/rest/v1/shtab_workspaces?select=id&limit=1',s.access_token);if(!rows.length)throw Object.assign(Error('У этого аккаунта нет доступа к штабу'),{status:403});
 setSession(res,s);reply(res,200,{ok:true});
 }catch(e){reply(res,e.status||400,{error:e.message});}}

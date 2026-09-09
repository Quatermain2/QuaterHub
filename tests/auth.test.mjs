import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {authenticated,setSession} from '../server/http.js';

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;}});
test('browser restart restores session from only the persistent refresh cookie',async t=>{
 const res=response();
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.match(url,/grant_type=refresh_token/);
  assert.equal(JSON.parse(options.body).refresh_token,'saved-refresh');
  return new Response(JSON.stringify({access_token:'new-access',refresh_token:'rotated-refresh',expires_in:3600,user:{email_confirmed_at:'2026-09-09'}}));
 });
 const session=await authenticated({headers:{cookie:'shtab_refresh=saved-refresh'}},res);
 assert.equal(session.token,'new-access');
 assert.match(res.headers['Set-Cookie'][0],/Max-Age=3600/);
 assert.match(res.headers['Set-Cookie'][1],/shtab_refresh=rotated-refresh; HttpOnly;.*Path=\/api; Max-Age=31536000/);
});
test('temporary refresh error keeps existing cookies; revoked refresh requires login',async t=>{
 const res=response();let status=503;
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:'unavailable'}),{status}));
 const req={headers:{cookie:'shtab_refresh=saved-refresh'}};
 await assert.rejects(authenticated(req,res),{status:503});
 assert.equal(res.headers['Set-Cookie'],undefined);
 status=400;
 await assert.rejects(authenticated(req,res),{status:401});
});
test('logout clears both persistent credentials',()=>{
 const res=response();setSession(res,{});
 assert.equal(res.headers['Set-Cookie'].length,2);
 for(const cookie of res.headers['Set-Cookie'])assert.match(cookie,/Max-Age=0$/);
});
test('temporary auth outage does not redirect an open dashboard, 401 does',async()=>{
 const code=readFileSync(new URL('../public/session.js',import.meta.url),'utf8');
 for(const status of [503,403,401]){
  const redirects=[];
  const context=vm.createContext({window:{},location:{replace:path=>redirects.push(path)},fetch:async()=>({status})});
  vm.runInContext(code,context);
  await vm.runInContext('shtabSessionReady',context);
  assert.deepEqual(redirects,status===401?['/']:[]);
 }
});

import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const code=fs.readFileSync(new URL('./desktop-core.js',import.meta.url),'utf8');
process.env.TZ='Europe/Moscow';
export function runtime(tables,links={}){
 class Range {
  constructor(sheet,r,c,n=1,m=1){Object.assign(this,{sheet,r,c,n,m});if(![r,c,n,m].every(Number.isInteger)||Math.min(r,c,n,m)<1||n*m>100000)throw Error('Некорректный диапазон');}
  getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sheet.rows[this.r+i-1]?.[this.c+j-1]??''));}
  getDisplayValues(){return this.getValues().map(r=>r.map(v=>String(v??'')));}
  getRichTextValues(){return this.getDisplayValues().map((row,i)=>row.map((v,j)=>({getLinkUrl:()=>links[this.sheet.name+'!'+(this.r+i)+':'+(this.c+j)]||v.match(/https?:\/\/[^\s]+/)?.[0]||''})));}
  setValues(v){if(v.length!==this.n||v.some(r=>r.length!==this.m))throw Error('Неверный размер записи');v.forEach((row,i)=>{this.sheet.rows[this.r+i-1]??=[];row.forEach((x,j)=>{this.sheet.rows[this.r+i-1][this.c+j-1]=x;});});return this;}
  setValue(v){return this.setValues([[v]])} isPartOfMerge(){return false}
  setVerticalAlignment(){return this}setWrap(){return this}setNumberFormat(){return this}copyTo(){return this}
 }
 class Sheet {
  constructor(name){this.name=name;this.rows=tables[name];}
  getLastRow(){return this.rows.length}getRange(...a){return new Range(this,...a)}
  appendRow(row){this.rows.push(row)}insertRowBefore(r){this.rows.splice(r-1,0,[])}setFrozenRows(){}
 }
 const ss={getSheetByName:n=>tables[n]?new Sheet(n):null,insertSheet:n=>{tables[n]=[];return new Sheet(n)},getUrl:()=>'/data.html',getName:()=> 'Данные штаба'};
 const formatDate=(d,tz,pattern)=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(d)).map(p=>[p.type,p.value]));
  const vals={yyyy:parts.year,MM:parts.month,dd:parts.day,HH:parts.hour,mm:parts.minute,ss:parts.second,M:String(Number(parts.month)),d:String(Number(parts.day))};
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|M|d/g,k=>vals[k]);
 };
 const context={Date,Math,Number,String,Boolean,Object,Array,Set,Map,JSON,RegExp,Error,isNaN,parseInt,parseFloat,console,
 SpreadsheetApp:{openById:()=>ss,flush(){},CopyPasteType:{PASTE_FORMAT:'format'}},
 Utilities:{formatDate,getUuid:randomUUID},LockService:{getDocumentLock:()=>({waitLock(){},releaseLock(){}}),getScriptLock:()=>({waitLock(){},releaseLock(){}})}};
 vm.createContext(context);vm.runInContext(code,context,{timeout:2000});return context;
}

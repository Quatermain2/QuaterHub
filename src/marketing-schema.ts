import { z } from 'zod';
export const statuses=['Новая','В работе','Выполнено','Ожидает'] as const;
export const taskSchema=z.object({id:z.string().max(100),title:z.string().min(1).max(300),stage:z.string().min(1).max(100),owner:z.string().max(120),due:z.string().refine(v=>v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)),status:z.enum(statuses),result:z.string().max(5000),depends:z.array(z.string()).max(30)});
export type Task=z.infer<typeof taskSchema>;
export const projectSchema=z.object({id:z.string(),title:z.string().max(200),short:z.string().max(100),priority:z.enum(['P0','P1','P2']),description:z.string().max(3000),participants:z.string().max(300),owner:z.string().max(120),note:z.string().max(3000),tasks:z.array(taskSchema).max(300)});
export type Project=z.infer<typeof projectSchema>;
export const stateSchema=z.object({projects:z.array(projectSchema).min(1).max(30),history:z.array(z.object({id:z.string(),date:z.string(),text:z.string().max(1000)})).max(1000),briefings:z.array(z.object({id:z.string(),date:z.string(),text:z.string().max(20000)})).max(100)}).superRefine((s,ctx)=>{const ids=s.projects.flatMap(p=>p.tasks.map(t=>t.id));if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Повторяющиеся задачи'});});
export type State=z.infer<typeof stateSchema>;
function project(id:string,title:string,short:string,priority:Project['priority'],description:string,participants:string,owner:string,note:string,groups:[string,string[]][]):Project {return {id,title,short,priority,description,participants,owner,note,tasks:groups.flatMap(([stage,titles],g)=>titles.map((title,i)=>({id:`${id}-${g}-${i}`,title,stage,owner,due:'',status:'Новая',result:'',depends:[]})))};}
export const seed:State={projects:[],history:[],briefings:[]};
export const progress=(p:Project)=>Math.round(p.tasks.filter(t=>t.status==='Выполнено').length/Math.max(1,p.tasks.length)*100);
export const blocked=(t:Task,state:State)=>t.depends.filter(id=>state.projects.flatMap(p=>p.tasks).some(x=>x.id===id&&x.status!=='Выполнено'));

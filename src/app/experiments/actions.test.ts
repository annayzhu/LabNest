import {expect,it,vi} from 'vitest';import {updateExperiment} from './actions';
const state=vi.hoisted(()=>({completed:true,updateStep:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:()=>{}}));vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
vi.mock('@/lib/document-media.server',()=>({associateDocumentMedia:async()=>{}}));
vi.mock('@/lib/db',()=>{const tx={experiment:{findUnique:async()=>({id:'exp',researchPlanId:'plan'}),update:async()=>({})},experimentStep:{findMany:async()=>[{id:'step',completed:state.completed}],update:state.updateStep},activityLog:{create:async()=>({})}};return{prisma:{...tx,$transaction:async(callback:(client:typeof tx)=>unknown)=>callback(tx)}};});
it('saving experiment prose cannot clear or replace Run completion flags',async()=>{const form=new FormData();Object.entries({id:'exp',researchPlanId:'plan',title:'Edited prose',date:'2026-09-10',status:'running',recordStatus:'draft',methodMode:'custom'}).forEach(([k,v])=>form.set(k,v));await expect(updateExperiment({},form)).rejects.toThrow('redirect');expect(state.updateStep).not.toHaveBeenCalled();});

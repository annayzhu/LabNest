import {prisma} from '../src/lib/db';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
async function main(){
 if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_debug_20260910')throw Error('Synthetic database required');
 const plan=await prisma.researchPlan.findFirstOrThrow({where:{code:{startsWith:'DEBUG10-'}}});
 const document={schemaVersion:1,sections:[{key:'material',title:'Shared materials',blocks:[{id:'shared',type:'table',rows:[['Material','Volume'],['Buffer','7 µL']]}]},{key:'steps',title:'Steps',blocks:[{id:'a',type:'heading',text:'1. Prepare'},{id:'ca',type:'checklist',items:['Add buffer','Mix']},{id:'b',type:'heading',text:'2. Prepare'},{id:'table-b',type:'table',rows:[['Component','Volume'],['DNA','2 µL']]},{id:'cb',type:'checklist',items:['Add DNA']}]}]};
 const captured=[{order:1,title:'Prepare',description:'Add buffer\nMix',requires_confirmation:true,allows_deviation:true},{order:2,title:'Prepare',description:'Add DNA',requires_confirmation:true,allows_deviation:true}];
 const cases=[];
 for(const [index,kind] of ['recoverable','unverified'].entries()){
  const snapshot={versions:[{protocolVersionId:'synthetic-frozen-v1',stepsJson:captured,...(kind==='recoverable'?{contentJson:document}:{})}]};
  const experiment=await prisma.experiment.create({data:{projectId:plan.projectId,researchPlanId:plan.id,runCode:`EXP-${Date.now()+index}`,title:`Sep10 synthetic legacy ${kind}`,protocolSnapshotJson:snapshot,steps:{create:captured.map(step=>({order:step.order,title:step.title,description:step.description,groupKey:'synthetic-frozen-v1',groupTitle:'Synthetic frozen v1',protocolStepRef:`synthetic-frozen-v1:${step.order}`,completed:step.order===1}))}},include:{steps:{orderBy:{order:'asc'}}}});
  cases.push({kind,id:experiment.id,steps:experiment.steps.map(s=>({id:s.id,ref:s.protocolStepRef})),snapshotHash:createHash('sha256').update(JSON.stringify(experiment.protocolSnapshotJson)).digest('hex')});
 }
 writeFileSync('docs/debug-20260910/evidence/legacy-fixtures.json',JSON.stringify({synthetic:true,cases},null,2));
}
main().finally(()=>prisma.$disconnect());

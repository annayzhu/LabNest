import 'dotenv/config';
import {prisma} from '../src/lib/db';
import {readFileSync,writeFileSync} from 'node:fs';
if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw Error('Synthetic database only');
async function main(){
 const {experimentId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json','utf8'));
 const {planId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/editor/fixtures.json','utf8'));
 await prisma.experiment.update({where:{id:experimentId},data:{researchPlanId:planId}});
 const steps=await prisma.experimentStep.findMany({where:{experimentId},orderBy:{order:'asc'}});
 if(steps.length!==3)throw Error('Expected three synthetic steps');
 await prisma.entry.upsert({where:{clientMutationId:'debug-step-evidence-observation'},create:{clientMutationId:'debug-step-evidence-observation',title:'合成步骤观察',body:'仅归属取样步骤：样本均匀',experimentId,experimentStepId:steps[0].id},update:{}});
 writeFileSync('docs/debug-20260909/evidence/step-evidence-fixture.json',JSON.stringify({experimentId,steps:steps.map(s=>({id:s.id,title:s.title}))},null,2));
 await prisma.$disconnect();
}
main().catch(e=>{console.error(e);process.exitCode=1});

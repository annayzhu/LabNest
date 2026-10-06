import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {prisma} from '../src/lib/db';
import {stepsWithExecutionEvidence} from '../src/lib/run-evidence.server';
import {createEntryWithFiles,updateEntryWithFiles} from '../src/lib/entry-persistence';
import {parseEntryMutationFormData} from '../src/lib/entry-mutations';
import {freezeEntrySources,getEntrySources} from '../src/lib/entry-assignment.server';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/labnest_entry_richtext_test_20261006');
async function main(){
 const experiment=await prisma.experiment.create({data:{title:'测试步骤冻结旁路',runCode:'TEST-STEP-FREEZE-'+Date.now()}});
 const step=await prisma.experimentStep.create({data:{experimentId:experiment.id,order:0,title:'测试步骤',description:'TEST-STEP-BASE'}});
 const form=new FormData();Object.entries({title:'测试步骤来源',contentMarkdown:'TEST-STEP-BEFORE',experimentId:experiment.id,experimentStepId:step.id}).forEach(([k,v])=>form.set(k,v));
 const entry=await createEntryWithFiles(parseEntryMutationFormData(form),[]);
 assert(JSON.stringify(await stepsWithExecutionEvidence([step])).includes('TEST-STEP-BEFORE'));
 await prisma.$transaction(async tx=>{await freezeEntrySources(tx,'experiment',experiment.id);await tx.experiment.update({where:{id:experiment.id},data:{recordStatus:'submitted'}});});
 const change=new FormData();change.set('title','测试步骤来源');change.set('contentMarkdown','TEST-STEP-AFTER');
 await updateEntryWithFiles(entry.id,parseEntryMutationFormData(change),[],[],[]);
 assert(!(JSON.stringify(await stepsWithExecutionEvidence([step]))).includes('TEST-STEP-AFTER'),'Locked step must not read mutable Entry content');
 assert.equal((await getEntrySources('experiment',experiment.id,true)).sources[0].markdown,'TEST-STEP-BEFORE');
 await prisma.experiment.update({where:{id:experiment.id},data:{recordStatus:'draft'}});
 assert(JSON.stringify(await stepsWithExecutionEvidence([step])).includes('TEST-STEP-AFTER'));
 writeFileSync('docs/qa/evidence/entry-richtext/step-freeze.json',JSON.stringify({synthetic:true,experimentId:experiment.id,checks:[{name:'Unlocked step shows live source; submitted target hides mutable step evidence, keeps frozen source; reopen shows live source',status:'通过'}]},null,2));
}
main().finally(()=>prisma.$disconnect());

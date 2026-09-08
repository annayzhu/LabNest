import 'dotenv/config';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {prisma} from '../src/lib/db';
import {createScientificDocument, researchPlanSections, experimentSections, resultSections, reportSections} from '../src/lib/scientific-document';
import {createEmptyProtocolDocument} from '../src/lib/protocol-document';
import {buildEntryContent} from '../src/lib/entry-content';
assert(new URL(process.env.DATABASE_URL!).pathname === '/labnest_editor66_acceptance');
async function main(){
const stamp=Date.now();const project=await prisma.project.create({data:{name:`Synthetic editor ${stamp}`}});
const doc=(sections:Parameters<typeof createScientificDocument>[0])=>{const d=createScientificDocument(sections);d.sections[0].blocks=[{id:'fixture-body',type:'text',text:'Editor acceptance body / 正文验收'}];return d;};
const plan=await prisma.researchPlan.create({data:{projectId:project.id,code:`RPL-${stamp}`,title:'Synthetic research plan',contentJson:doc(researchPlanSections)}});
const exp=await prisma.experiment.create({data:{projectId:project.id,researchPlanId:plan.id,runCode:`EXP-${stamp}`,title:'Synthetic experiment',contentJson:doc(experimentSections)}});
const result=await prisma.result.create({data:{experimentId:exp.id,title:'Synthetic result',resultType:'Observation',contentJson:doc(resultSections)}});
const report=await prisma.report.create({data:{projectId:project.id,title:'Synthetic report',contentJson:doc(reportSections)}});
const entry=await prisma.entry.create({data:{title:'Synthetic entry',body:'Editor acceptance body',contentJson:buildEntryContent('Editor acceptance body',[])}});
const protocol=await prisma.protocol.create({data:{humanCode:`PRT-${stamp}`,title:`Synthetic protocol ${stamp}`,canonicalTitle:`Synthetic protocol ${stamp}`}});
const protocolDoc=createEmptyProtocolDocument();protocolDoc.sections.find(s=>s.key==='steps')!.blocks=[{id:'step-a',type:'heading',text:'Step A'},{id:'step-text',type:'text',text:'Editor acceptance body'}];
const version=await prisma.protocolVersion.create({data:{protocolId:protocol.id,revision:1,title:`Synthetic protocol ${stamp}`,contentJson:protocolDoc}});
const cases=[{name:'research-plan',edit:`/research-plans/${plan.id}/edit`,view:`/research-plans/${plan.id}`,save:'Save Research Plan'},{name:'experiment',edit:`/experiments/${exp.id}/edit`,view:`/experiments/${exp.id}`,save:'Save Experiment'},{name:'result',edit:`/results/${result.id}/edit`,view:`/results/${result.id}`,save:'Save Result'},{name:'report',edit:`/reports/${report.id}/edit`,view:`/reports/${report.id}`,save:'Save Report'},{name:'protocol',edit:`/protocols/${protocol.id}/versions/${version.id}/edit`,view:`/protocols/${protocol.id}`,save:'Save Protocol'},{name:'entry',edit:`/entries/${entry.id}/edit`,view:`/entries/${entry.id}`,save:'Save changes'}];
writeFileSync('docs/editor-repair/evidence/fixtures.json',JSON.stringify({synthetic:true,protocolTitle:protocol.title,projectId:project.id,planId:plan.id,experimentId:exp.id,protocolId:protocol.id,versionId:version.id,cases},null,2));
}
main().finally(()=>prisma.$disconnect());

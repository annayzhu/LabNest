import {prisma} from '../src/lib/db';
import {createScientificDocument,researchPlanSections,resultSections,experimentSections} from '../src/lib/scientific-document';
import {writeFileSync} from 'node:fs';
async function main(){
 if(!process.env.DATABASE_URL?.includes('/labnest_qpcr_acceptance'))throw Error('Acceptance only');
 const project=await prisma.project.create({data:{name:'qPCR workflow · Synthetic acceptance'}});
 const plan=await prisma.researchPlan.create({data:{code:'RP-QPCR-'+Date.now(),title:'qPCR 合成验收计划',projectId:project.id,contentJson:createScientificDocument(researchPlanSections)}});
 const experiment=await prisma.experiment.create({data:{runCode:'EXP-QPCR-'+Date.now(),title:'qPCR 合成验收实验',date:new Date('2026-11-03'),projectId:project.id,researchPlanId:plan.id,contentJson:createScientificDocument(experimentSections)}});
 const result=await prisma.result.create({data:{experimentId:experiment.id,projectId:project.id,researchPlanId:plan.id,title:'qPCR 合成验收结果',resultType:'qPCR',contentJson:createScientificDocument(resultSections)}});
 writeFileSync('/private/tmp/qpcr-fixtures.json',JSON.stringify({projectId:project.id,planId:plan.id,experimentId:experiment.id,resultId:result.id}));
 console.log({planId:plan.id,experimentId:experiment.id,resultId:result.id});
 await prisma.$disconnect();
}main().catch(e=>{console.error(e);process.exitCode=1});

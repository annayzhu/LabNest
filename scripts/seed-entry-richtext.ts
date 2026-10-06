import "dotenv/config";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { createScientificDocument, researchPlanSections, experimentSections, resultSections, reportSections } from "../src/lib/scientific-document";
import { createEmptyProtocolDocument } from "../src/lib/protocol-document";
import { buildEntryContent } from "../src/lib/entry-content";
assert.equal(new URL(process.env.DATABASE_URL!).pathname,"/labnest_entry_richtext_test_20261006");
async function main(){
 const stamp=Date.now(),project=await prisma.project.create({data:{name:`测试富文本项目 ${stamp}`}});
 const doc=(sections:Parameters<typeof createScientificDocument>[0])=>{const d=createScientificDocument(sections);d.sections[0].blocks=[{id:"test-body",type:"text",text:"测试正文 English 123 µL"}];return d;};
 const plan=await prisma.researchPlan.create({data:{projectId:project.id,code:`RPL-test-${stamp}`,title:"测试研究方案",contentJson:doc(researchPlanSections)}});
 const experiment=await prisma.experiment.create({data:{projectId:project.id,researchPlanId:plan.id,runCode:`EXP-test-${stamp}`,title:"测试实验",contentJson:doc(experimentSections),steps:{create:[{order:1,title:"测试步骤",description:"测试执行记录",requiresConfirmation:true}]}}});
 const result=await prisma.result.create({data:{experimentId:experiment.id,title:"测试结果",resultType:"Observation",contentJson:doc(resultSections)}});
 const report=await prisma.report.create({data:{projectId:project.id,title:"测试报告",contentJson:doc(reportSections)}});
 const entry=await prisma.entry.create({data:{title:"测试旧记录",body:"测试旧正文",createdAt:new Date("2026-10-01T01:15:00Z"),occurredAt:new Date("2026-09-30T01:15:00Z"),contentJson:buildEntryContent("测试旧正文",[])}});
 const protocol=await prisma.protocol.create({data:{humanCode:`PRT-test-${stamp}`,title:"测试规程",canonicalTitle:"测试规程"}}),protocolDoc=createEmptyProtocolDocument();protocolDoc.sections.find(s=>s.key==="steps")!.blocks=[{id:"test-heading",type:"heading",text:"测试步骤"},{id:"test-step",type:"text",text:"测试步骤正文"}];
 const version=await prisma.protocolVersion.create({data:{protocolId:protocol.id,revision:1,title:"测试规程",contentJson:protocolDoc}});
 const inventory=await prisma.inventoryItem.create({data:{name:"测试试剂",currentQuantity:100,unit:"mL"}});
 const cases=[{name:"research-plan",edit:`/research-plans/${plan.id}/edit`,view:`/research-plans/${plan.id}`,save:"Save Research Plan"},{name:"experiment",edit:`/experiments/${experiment.id}/edit`,view:`/experiments/${experiment.id}`,save:"Save Experiment"},{name:"result",edit:`/results/${result.id}/edit`,view:`/results/${result.id}`,save:"Save Result"},{name:"report",edit:`/reports/${report.id}/edit`,view:`/reports/${report.id}`,save:"Save Report"},{name:"protocol",edit:`/protocols/${protocol.id}/versions/${version.id}/edit`,view:`/protocols/${protocol.id}`,save:"Save Protocol"},{name:"entry",edit:`/entries/${entry.id}/edit`,view:`/entries/${entry.id}`,save:"Save changes"}];
 mkdirSync("docs/qa/evidence/entry-richtext",{recursive:true});writeFileSync("docs/qa/evidence/entry-richtext/fixtures.json",JSON.stringify({synthetic:true,projectId:project.id,planId:plan.id,experimentId:experiment.id,resultId:result.id,reportId:report.id,entryId:entry.id,protocolId:protocol.id,versionId:version.id,inventoryId:inventory.id,cases},null,2));
}
main().finally(()=>prisma.$disconnect());

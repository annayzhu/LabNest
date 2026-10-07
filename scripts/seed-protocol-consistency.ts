import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {prisma} from '../src/lib/db';
import {createEmptyProtocolDocument,projectProtocolDocument,type ProtocolDocument} from '../src/lib/protocol-document';
import {createScientificDocument,researchPlanSections,experimentSections} from '../src/lib/scientific-document';
import {getAttachmentRoot} from '../src/lib/attachments';
import {createExperimentWithProtocolSnapshot} from '../src/lib/experiments';
import {exportProtocolDocx} from '../src/lib/protocol-docx-export';
import {exportProtocolExecutionExample} from '../src/lib/protocol-docx-template';
import {parseProtocolDocxBytes} from '../src/lib/protocol-docx';
const database=new URL(process.env.DATABASE_URL!).pathname;assert(database.includes('protocol_consistency') && database!=='/labnest','Synthetic fixtures require an explicitly isolated protocol_consistency database.');
const output=process.env.LABNEST_QA_DIR??'docs/qa/protocol-consistency-20261007/evidence';mkdirSync(output,{recursive:true});
async function main(){
 const stamp=Date.now(),project=await prisma.project.create({data:{name:`测试执行一致性 ${stamp}`}}),plan=await prisma.researchPlan.create({data:{projectId:project.id,code:`RPL-QA-${stamp}`,title:'测试执行一致性计划',status:'active',contentJson:createScientificDocument(researchPlanSections)}});
 const image=await sharp({create:{width:160,height:100,channels:3,background:'#628e94'}}).png().toBuffer();mkdirSync(getAttachmentRoot(),{recursive:true});const filename=`protocol-consistency-${stamp}.png`;writeFileSync(path.join(getAttachmentRoot(),filename),image);
 const attachment=await prisma.attachment.create({data:{filename,originalFilename:'测试步骤图片.png',mimeType:'image/png',size:image.length,storagePath:filename,sha256:createHash('sha256').update(image).digest('hex')}});
 const document=createEmptyProtocolDocument();document.executionConfirmed=true;
 document.sections.find(section=>section.key==='steps')!.blocks=[
  {id:'qa-info',type:'checklist',items:['以下为1个样本的总用量；用于结构验收，不提供真实科研配方。'],execution:{role:'info'}},
  {id:'qa-dose-table',type:'table',caption:'工作用量参考',rows:[['规格','用量'],['合成示例','200 µL']],execution:{role:'info'}},
  {id:'qa-a',type:'checklist',items:['准备示例 A'],execution:{role:'step',stepId:'qa-operation-a',title:'准备示例 A'}},
  {id:'qa-body-a',type:'rich_text',nodes:[{type:'paragraph',content:[{text:'准备示例 A'}]},{type:'paragraph',content:[{text:'完整说明 200 µL，20–25°C；观察标记。',bold:true}]},{type:'paragraph',content:[{text:'H'},{text:'2',subscript:true},{text:'O 10'},{text:'6',superscript:true},{text:' cells',link:'https://example.org/source'}]}],execution:{role:'detail',stepId:'qa-operation-a'}},
  {id:'qa-table-a',type:'table',rows:[['Component','Volume'],['Buffer','{{dose}} µL']],cellRichContent:[[null,null],[null,[{type:'paragraph',content:[{type:'text',text:'{{dose}} µL',marks:[{type:'bold'}]}]}]]],execution:{role:'detail',stepId:'qa-operation-a'}},
  {id:'qa-image-a',type:'media',mediaType:'image',attachmentId:attachment.id,url:`/api/attachments/${attachment.id}`,filename:'测试步骤图片.png',caption:'测试图注',execution:{role:'detail',stepId:'qa-operation-a'}},
  {id:'qa-b',type:'heading',text:'观察示例 B',execution:{role:'step',stepId:'qa-operation-b',title:'观察示例 B'}},
  {id:'qa-body-b',type:'rich_text',nodes:[{type:'paragraph',content:[{text:'同一操作第二段 30 µL。'}]},{type:'bullet',content:[{text:'父项说明'}],childContent:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'嵌套说明 5 min'}]}]}]}]}],execution:{role:'detail',stepId:'qa-operation-b'}},
  {id:'qa-c',type:'heading',text:'准备示例 A',execution:{role:'step',stepId:'qa-operation-c',title:'准备示例 A'}},
  {id:'qa-body-c',type:'text',text:'重复洗涤操作需要单独保留；实际体积 40 µL。',execution:{role:'detail',stepId:'qa-operation-c'}},
  {id:'qa-reference',type:'text',text:'参考资料：结构验证使用合成内容，不构成实验建议。',execution:{role:'info'}},
 ];
 const create=async(code:string,title:string,doc:ProtocolDocument)=>{const projection=projectProtocolDocument(doc);const protocol=await prisma.protocol.create({data:{humanCode:code,title,canonicalTitle:title}});const version=await prisma.protocolVersion.create({data:{protocolId:protocol.id,revision:1,title,displayVersion:'1.0',stepsJson:projection.steps,contentJson:doc,parametersJson:[{name:'dose',type:'number',default:7,unit:'µL'}]}});return {protocol,version};};
 const main=await create(`PRT-9${String(stamp).slice(-5)}`,'合成多段步骤验收',document),ambiguous=createEmptyProtocolDocument();ambiguous.sections.find(section=>section.key==='steps')!.blocks=[{id:'unknown-a',type:'text',text:'未划分说明 A'},{id:'unknown-b',type:'text',text:'未划分说明 B'}];
 const referenceDocument=createEmptyProtocolDocument();referenceDocument.executionConfirmed=true;referenceDocument.sections.find(section=>section.key==='steps')!.blocks=[{id:'reference-only',type:'text',text:'资料规程唯一信息 55 µL',execution:{role:'info'}}];
 const reference=await create(`PRT-6${String(stamp).slice(-5)}`,'合成纯资料规程',referenceDocument);
 const review=await create(`PRT-8${String(stamp).slice(-5)}`,'需作者确认的说明文档',ambiguous);
 const input={researchPlanId:plan.id,title:'重复创建验收',date:new Date('2026-10-07T01:00:00Z'),status:'planned' as const,recordStatus:'draft' as const,tags:[],contentJson:createScientificDocument(experimentSections),methodMode:'protocol' as const,protocolVersionIds:[main.version.id],customSteps:[],creationKey:randomUUID()};
 const [first,replay]=await Promise.all([createExperimentWithProtocolSnapshot(input),createExperimentWithProtocolSnapshot(input)]);assert.equal(first.id,replay.id);
 const firstRead=await prisma.experiment.findUniqueOrThrow({where:{id:first.id},include:{steps:true}});assert.equal(firstRead.steps.length,3);assert(firstRead.steps.every(step=>!step.completed && !step.completedAt));
 const mixed=await createExperimentWithProtocolSnapshot({...input,title:'混合操作与资料规程',protocolVersionIds:[main.version.id,reference.version.id],creationKey:randomUUID()});
 const protectedExperiment=await createExperimentWithProtocolSnapshot({...input,title:'合成已完成保护记录',creationKey:randomUUID()});await prisma.experiment.update({where:{id:protectedExperiment.id},data:{status:'completed',recordStatus:'reviewed'}});
 const docx=exportProtocolDocx({humanCode:`PRT-7${String(stamp).slice(-5)}`,canonicalTitle:'合成 DOCX 归属验收',availability:'draft',reviewStage:'draft',displayVersion:'1.0',scope:'general',tags:[]},document,{[attachment.id]:{bytes:image,extension:'png',mimeType:'image/png',width:160,height:100}});writeFileSync(output+'/source.docx',docx);
 const example=parseProtocolDocxBytes(exportProtocolExecutionExample(),'LabNest_Protocol_Execution_Example_v0.3_Draft.docx').document;
 writeFileSync(output+'/template-example.docx',exportProtocolDocx({humanCode:`PRT-5${String(stamp).slice(-5)}`,canonicalTitle:'已填写结构示例 '+stamp,availability:'draft',reviewStage:'draft',displayVersion:'0.3',scope:'general',tags:[]},example));
 let inventory=await prisma.protocol.findMany({where:{availability:{not:'archived'},humanCode:{notIn:[main.protocol.humanCode,review.protocol.humanCode]}},include:{versions:{orderBy:{revision:'desc'},take:1}}});
 if(process.env.LABNEST_QA_CATALOG_FILE){const catalog=JSON.parse(readFileSync(process.env.LABNEST_QA_CATALOG_FILE,'utf8'));const ids=new Set(catalog.report.map((row:{newVersionId:string})=>row.newVersionId));inventory=inventory.filter(protocol=>ids.has(protocol.versions[0].id));}else inventory=inventory.filter(protocol=>![main.protocol.id,review.protocol.id,reference.protocol.id].includes(protocol.id));
 writeFileSync(output+'/fixtures.json',JSON.stringify({synthetic:true,mixedExperimentId:mixed.id,referenceVersionId:reference.version.id,planId:plan.id,protocolId:main.protocol.id,versionId:main.version.id,reviewProtocolId:review.protocol.id,reviewVersionId:review.version.id,idempotentExperimentId:first.id,protectedExperimentId:protectedExperiment.id,attachmentId:attachment.id,originalProtocols:inventory.map(protocol=>({code:protocol.humanCode,protocolId:protocol.id,versionId:protocol.versions[0].id,steps:Array.isArray(protocol.versions[0].stepsJson)?protocol.versions[0].stepsJson.length:0}))},null,2));
 console.log(JSON.stringify({synthetic:true,creationReplaySameId:first.id===replay.id,stepCount:firstRead.steps.length,originalProtocolCount:inventory.length}));
}
main().finally(()=>prisma.$disconnect());

import 'dotenv/config';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '../src/generated/prisma/client';
import {prisma} from '../src/lib/db';
import {protocolDocumentSchema,protocolExecutionRoleSchema,projectProtocolDocument} from '../src/lib/protocol-document';
import {executionFragments,confirmExecutionRoles} from '../src/lib/protocol-execution';
import {associateDocumentMedia} from '../src/lib/document-media.server';
import {resolveAttachmentPath} from '../src/lib/attachments';
import {parseProtocolDocxBytes} from '../src/lib/protocol-docx';
import {isDeepStrictEqual} from 'node:util';
import {executionBlockText} from '../src/lib/protocol-execution';
import {assertDocumentMediaReady} from '../src/lib/document-media';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const schema=z.object({baseline:z.string(),entries:z.array(z.object({versionId:z.string(),beforeHash:z.string(),restoreStepsFrom:z.object({attachmentId:z.string(),checksum:z.string(),sections:z.array(z.enum(['steps','result_templates','consumption_rules'])).default(['steps'])}).optional(),decisions:z.record(z.string(),protocolExecutionRoleSchema)}))});
const args=process.argv.slice(2),planPath=args.find(arg=>arg.startsWith('--plan='))?.slice(7),output=args.find(arg=>arg.startsWith('--output='))?.slice(9)??'.local-runtime/protocol-consistency/plan';
if(!planPath)throw new Error('Provide --plan=<audited decisions JSON>. Default is dry-run. Add --apply only after examining the backup/diff.');
const plan=schema.parse(JSON.parse(readFileSync(planPath,'utf8'))),apply=args.includes('--apply');mkdirSync(output,{recursive:true});
async function main(){
 const report=[];
 for(const entry of plan.entries){
  const result=await prisma.$transaction(async tx=>{
   const identity=await tx.protocolVersion.findUniqueOrThrow({where:{id:entry.versionId},select:{protocolId:true}});
   await tx.$queryRaw`SELECT id FROM "Protocol" WHERE id=${identity.protocolId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "ProtocolVersion" WHERE id=${entry.versionId} FOR UPDATE`;
   const source=await tx.protocolVersion.findUniqueOrThrow({where:{id:entry.versionId},include:{protocol:true}});
   const latest=await tx.protocolVersion.findFirst({where:{protocolId:source.protocolId},orderBy:{revision:'desc'}});
   // Replays are read-only; unrelated new revisions invalidate the audited plan.
   if(hash(source.contentJson)!==entry.beforeHash)throw new Error(`${source.protocol.humanCode}: audited source changed; stop and re-audit.`);
   if(source.protocol.availability==='archived')throw new Error('Archived Protocols are outside the current-library repair scope.');
   let document=protocolDocumentSchema.parse(source.contentJson);
   if(entry.restoreStepsFrom) {
    for(const key of entry.restoreStepsFrom.sections)if(document.sections.find(section=>section.key===key)?.blocks.some(block=>executionBlockText(block).trim()||block.type!=='rich_text'||block.nodes.some(node=>node.childContent?.length)))throw new Error('DOCX recovery is restricted to explicitly selected empty saved sections.');
    const attachment=await tx.attachment.findUniqueOrThrow({where:{id:entry.restoreStepsFrom.attachmentId}});
    const bytes=readFileSync(resolveAttachmentPath(attachment.storagePath)),checksum=createHash('sha256').update(bytes).digest('hex');
    if(checksum!==entry.restoreStepsFrom.checksum||checksum!==source.sourceFileChecksum||checksum!==attachment.sha256)throw new Error('Original DOCX identity or checksum changed; stop recovery.');
    const original=parseProtocolDocxBytes(bytes,source.sourceFileName??attachment.originalFilename).document;
    if(!original.sections.find(section=>section.key==='steps')?.blocks.length)throw new Error('Original DOCX has no Steps content to recover.');
    document={...document,sections:document.sections.map(section=>entry.restoreStepsFrom!.sections.includes(section.key as 'steps'|'result_templates'|'consumption_rules')?{...section,blocks:original.sections.find(sourceSection=>sourceSection.key===section.key)?.blocks??[]}:section)};
   }
   const fragments=executionFragments(document);
   if(fragments.some(block=>!entry.decisions[block.id])||Object.keys(entry.decisions).some(id=>!fragments.some(block=>block.id===id)))throw new Error('Every source fragment must be mapped exactly once.');
   const confirmed=confirmExecutionRoles(document,fragments.map(block=>({...block,execution:entry.decisions[block.id]})));
   // This recovery CLI reuses existing managed media. Embedded Word images must
   // pass the regular reviewed import pipeline; dry-run must refuse them too.
   assertDocumentMediaReady(confirmed);
   if(latest?.previousVersionId===source.id&&latest.changeSummary==='2026-10-07: Confirm audited execution ownership; original prose preserved.') {
    if(!isDeepStrictEqual(protocolDocumentSchema.parse(latest.contentJson),protocolDocumentSchema.parse(confirmed)))throw new Error('Previously repaired revision was edited; re-audit instead of skipping it.');
    return {code:source.protocol.humanCode,newVersionId:latest.id,replay:true};
   }
   if(latest?.id!==source.id)throw new Error(`${source.protocol.humanCode}: latest version changed; stop and re-audit.`);
   const projected=projectProtocolDocument(confirmed);if(projected.executionNeedsReview)throw new Error('Invalid or incomplete execution ownership.');
   const diff={code:source.protocol.humanCode,sourceVersionId:source.id,beforeHash:entry.beforeHash,restoredStepsFrom:entry.restoreStepsFrom??null,beforeSteps:Array.isArray(source.stepsJson)?source.stepsJson.length:0,afterSteps:projected.steps.length,beforeResultTemplates:Array.isArray(source.resultTemplatesJson)?source.resultTemplatesJson.length:0,afterResultTemplates:projected.resultTemplates.length,beforeConsumptionRules:Array.isArray(source.consumptionRulesJson)?source.consumptionRulesJson.length:0,afterConsumptionRules:projected.consumptionRules.length,mapping:fragments.map(block=>({blockId:block.id,...entry.decisions[block.id]})),informationBlocks:projected.commonBlocks.map(block=>block.id)};
   // Originals remain private and immutable; every repair is a new ProtocolVersion.
   writeFileSync(`${output}/${source.protocol.humanCode}-original.json`,JSON.stringify(source,null,2));
   writeFileSync(`${output}/${source.protocol.humanCode}-diff.json`,JSON.stringify(diff,null,2));
   if(!apply)return diff;
   const parts=source.displayVersion.split('.');parts[parts.length-1]=String(Number(parts.at(-1))+1);const displayVersion=parts.join('.');
   const version=await tx.protocolVersion.create({data:{protocolId:source.protocolId,revision:source.revision+1,displayVersion,previousVersionId:source.id,reviewStage:'draft',recordStatus:'draft',sourceType:'manual',title:source.title.replace(/\bv\d+(?:\.\d+)+$/i,`v${displayVersion}`),purpose:source.purpose,background:source.background,scope:source.scope,notes:source.notes,parametersJson:source.parametersJson as Prisma.InputJsonValue,materialsJson:source.materialsJson as Prisma.InputJsonValue,equipmentJson:source.equipmentJson as Prisma.InputJsonValue,consumptionRulesJson:source.consumptionRulesJson as Prisma.InputJsonValue,resultTemplatesJson:source.resultTemplatesJson as Prisma.InputJsonValue,stepsJson:projected.steps,contentJson:confirmed,changeSummary:'2026-10-07: Confirm audited execution ownership; original prose preserved.'}});
   // Recovered sections and their machine projections must stay in agreement.
   if(entry.restoreStepsFrom?.sections.includes('result_templates'))await tx.protocolVersion.update({where:{id:version.id},data:{resultTemplatesJson:projected.resultTemplates}});
   if(entry.restoreStepsFrom?.sections.includes('consumption_rules'))await tx.protocolVersion.update({where:{id:version.id},data:{consumptionRulesJson:projected.consumptionRules}});
   await associateDocumentMedia(tx,confirmed,'protocol_version',version.id);
   await tx.activityLog.create({data:{action:'confirm_execution_structure',targetType:'protocol',targetId:source.protocolId,metadataJson:{...diff,newVersionId:version.id,sourceBaseline:plan.baseline}}});
   return {...diff,newVersionId:version.id};
  });report.push(result);
 }
 writeFileSync(`${output}/result.json`,JSON.stringify({apply,baseline:plan.baseline,report},null,2));console.log(JSON.stringify(report.map(row=>({code:row.code,newVersionId:'newVersionId' in row?row.newVersionId:null,afterSteps:'afterSteps' in row?row.afterSteps:null})),null,2));
}
main().finally(()=>prisma.$disconnect());

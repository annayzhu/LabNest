import {projectLegacyProtocolExecution} from "./protocol-execution-legacy";
import {executionBodyWithoutTitle,notesAmongSteps} from "./protocol-execution";
import {protocolDocumentSchema,projectProtocolDocument,type ProtocolContentBlock, isEmptyTable } from './protocol-document';
import {renderProtocolTemplate} from './protocol';
import type {ProtocolStep} from './types';
/** Old imports grouped each heading with its checklist. Validate the whole frozen
 * contract before recovering by ordinal; a matching title alone is insufficient. */
function legacyGroupedBlocks(document: ReturnType<typeof protocolDocumentSchema.parse>, captured: ProtocolStep[], order: number) {
 const groups: {title:string;blocks:ProtocolContentBlock[]}[]=[];
 for(const block of document.sections.find(section=>section.key==='steps')?.blocks??[]) {
  if(block.type==='heading')groups.push({title:block.text.replace(/^\d+[.、]\s*/,''),blocks:[]});
  else groups.at(-1)?.blocks.push(block);
 }
 if(groups.length!==captured.length || captured.some((step,index)=>{
  const group=groups[index];
  const checklist=group.blocks.filter(block=>block.type==='checklist');
  return Boolean(step.source_ref) || step.order!==index+1 || step.title!==group.title || !checklist.length || step.description!==checklist.flatMap(block=>block.items).join('\n');
 }))return undefined;
 return groups[order-1]?.blocks;
}
/** Resolve only the experiment's captured version, never the mutable protocol library. */
export function runStepContent(snapshot:unknown,step:{protocolStepRef:string|null;groupKey:string;order:number;title:string;description:string},parameters:Record<string,string|number|boolean>={}){
 const versions=(snapshot as {versions?:Array<{protocolVersionId:string;stepsJson?:ProtocolStep[];contentJson?:unknown}>})?.versions??[];
 const version=versions.find(v=>v.protocolVersionId===step.groupKey);
 const doc=protocolDocumentSchema.safeParse(version?.contentJson);
 const render=(value:unknown,key=''):unknown=>typeof value==='string'&&!['id','url','source_ref','attachmentId'].includes(key)?renderProtocolTemplate(value,parameters):Array.isArray(value)?value.map(v=>render(v,key)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,render(v,k)])):value;
 const reference=doc.success?render(doc.data.sections.filter(section=>section.blocks.length)) as typeof doc.data.sections:[];
 const legacy={blocks:[] as ProtocolContentBlock[],notesBefore:[] as ProtocolContentBlock[],notesAfter:[] as ProtocolContentBlock[],reference,source:'legacy-text' as string};
 if(!version)return legacy;
 const captured=version.stepsJson?.find(s=>step.protocolStepRef===`${version.protocolVersionId}:${s.source_ref??s.order}`);
 if(!captured)return legacy;
 const projection=doc.success?(doc.data.sections.some(section=>section.blocks.some(block=>block.execution))?projectProtocolDocument(doc.data):projectLegacyProtocolExecution(doc.data)):undefined;
 const projected=projection?.steps??[];
 // Old order refs are accepted only when the full projected step contract matches.
 const recovered=projected.find(s=>captured.source_ref && s.source_ref===captured.source_ref) ?? projected.find(s=>s.order===captured.order&&s.title===captured.title&&s.description===captured.description);
 const blocks=recovered?.content_blocks??captured.content_blocks??(doc.success?legacyGroupedBlocks(doc.data,version.stepsJson??[],captured.order):undefined);
 if(!blocks)return legacy;
 // The Protocol's notes keep their written place: those before this step, and those after it when it is the last.
 // Content that cannot be matched to a step never leaks into every step.
 const key=(projectedStep:ProtocolStep)=>projectedStep.source_ref??String(projectedStep.order);
 const order=projected.map(key),own=recovered?key(recovered):undefined;
 const placed=projection&&own?notesAmongSteps(projection.commonBlocks,projection.notePlacement,order):undefined;
 const notesBefore=own?placed?.before.get(own)??[]:[],notesAfter=own&&own===order.at(-1)?placed?.after??[]:[];
 // Parameter interpolation traverses textual content, including table rich cells; IDs and URLs are unchanged.

 // A step block's label is derived from its own body; nothing is a separate title to remove.
 const derived=(recovered??captured).title_source==='derived';
 return {reference,blocks:render((derived?blocks:executionBodyWithoutTitle(blocks,step.title)).filter(block=>!isEmptyTable(block))) as ProtocolContentBlock[],notesBefore:render(notesBefore) as ProtocolContentBlock[],notesAfter:render(notesAfter) as ProtocolContentBlock[],source:captured.content_blocks?'captured-blocks':'same-version-recovery',...(derived?{derivedTitle:true}:{})};
}

/** Publish only explicit same-origin image resources from this frozen Run. */
export function runOfflineImagePaths(snapshot:unknown):string[]{
 const paths=new Set<string>();
 const visit=(value:unknown)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const record=value as Record<string,unknown>;if(record.type==='media'&&record.mediaType==='image'&&typeof record.url==='string'&&/^\/api\/attachments\/[^/?]+(?:\?inline=1)?$/.test(record.url))paths.add(record.url);Object.values(record).forEach(visit);};visit(snapshot);return [...paths];
}

/** Visual nesting follows a captured checklist source, never its wording. */
export function runStepIsConfirmation(snapshot:unknown, step:{protocolStepRef?:string|null;groupKey?:string}) {
 const versions=(snapshot as {versions?:Array<{protocolVersionId:string;stepsJson?:ProtocolStep[];contentJson?:unknown}>})?.versions??[];
 const version=versions.find(value=>value.protocolVersionId===step.groupKey);
 const captured=version?.stepsJson?.find(value=>step.protocolStepRef===`${version.protocolVersionId}:${value.source_ref??value.order}`);
 const doc=protocolDocumentSchema.safeParse(version?.contentJson);
 if(!doc.success || !captured?.source_ref)return false;
 return doc.data.sections.flatMap(section=>section.blocks).some(block=>block.type==='checklist' && block.items.some((_,index)=>captured.source_ref===`${block.id}:${index}`));
}

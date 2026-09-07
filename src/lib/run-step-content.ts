import {protocolDocumentSchema,projectProtocolDocument,type ProtocolContentBlock} from './protocol-document';
import {renderProtocolTemplate} from './protocol';
import type {ProtocolStep} from './types';
/** Resolve only the experiment's captured version, never the mutable protocol library. */
export function runStepContent(snapshot:unknown,step:{protocolStepRef:string|null;groupKey:string;order:number;title:string;description:string},parameters:Record<string,string|number|boolean>={}){
 const versions=(snapshot as {versions?:Array<{protocolVersionId:string;stepsJson?:ProtocolStep[];contentJson?:unknown}>})?.versions??[];
 const version=versions.find(v=>v.protocolVersionId===step.groupKey);
 const legacy={blocks:[] as ProtocolContentBlock[],common:[] as ProtocolContentBlock[],source:'legacy-text' as string};
 if(!version)return legacy;
 const captured=version.stepsJson?.find(s=>step.protocolStepRef===`${version.protocolVersionId}:${s.source_ref??s.order}`);
 if(!captured)return legacy;
 const doc=protocolDocumentSchema.safeParse(version.contentJson);
 const projected=doc.success?projectProtocolDocument(doc.data).steps:[];
 // Old order refs are accepted only when the full projected step contract matches.
 const recovered=projected.find(s=>s.order===captured.order&&s.title===captured.title&&s.description===captured.description);
 const blocks=captured.content_blocks??recovered?.content_blocks;
 if(!blocks)return legacy;
 const used=new Set(projected.flatMap(s=>s.content_blocks?.map(b=>b.id)??[]));
 const common=doc.success?(doc.data.sections.find(s=>s.key==='steps')?.blocks??[]).filter(b=>!used.has(b.id)&&!['heading','text','rich_text','checklist'].includes(b.type)):[];
 // Parameter interpolation traverses textual content, including table rich cells; IDs and URLs are unchanged.
 const render=(value:unknown,key=''):unknown=>typeof value==='string'&&!['id','url','source_ref','attachmentId'].includes(key)?renderProtocolTemplate(value,parameters):Array.isArray(value)?value.map(v=>render(v,key)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,render(v,k)])):value;
 return {blocks:render(blocks) as ProtocolContentBlock[],common:render(common) as ProtocolContentBlock[],source:captured.content_blocks?'captured-blocks':'same-version-recovery'};
}

import {it,expect} from 'vitest';
import {createEmptyProtocolDocument,projectProtocolDocument,protocolDocumentSchema} from './protocol-document';
import {buildProtocolExperimentSteps} from './experiment-planning';
import {runStepContent,runOfflineImagePaths} from './run-step-content';
it('R01 R02 R04 stable block mapping retains tables, notes, and distinct same-title steps',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'shared',type:'callout',tone:'note',text:'Shared preparation'},{id:'a',type:'heading',text:'Same'},{id:'p',type:'text',text:'Prepare'},{id:'t',type:'table',rows:[['Component','Volume'],['Enzyme','{{dose}} µL'],['Other','{{unknown}}']]},{id:'note',type:'text',text:'After table'},{id:'b',type:'heading',text:'Same'},{id:'material',type:'table',rows:[['Material'],['Tube']]},{id:'check',type:'checklist',items:['Check A','Check B']}];
 const steps=projectProtocolDocument(doc).steps;
 expect(steps).toHaveLength(4);expect(steps[0].content_blocks?.map(b=>b.id)).toEqual(['p','t','note']);expect(steps[1].content_blocks?.map(b=>b.id)).toEqual(['material']);
 const runs=buildProtocolExperimentSteps([{versionId:'v1',humanCode:'PRT-001',versionTitle:'Synthetic',displayVersion:'1.0',protocolTitle:'Synthetic',steps}]);expect(runs[0].protocolStepRef).toBe('v1:a');expect(runs[1].protocolStepRef).toBe('v1:b');
 const snapshot={versions:[{protocolVersionId:'v1',stepsJson:steps,contentJson:doc}]};const original=JSON.stringify(snapshot);
 const content=runStepContent(snapshot,runs[0],{dose:.1});expect(JSON.stringify(content)).toContain('.1 µL');expect(JSON.stringify(content)).toContain('{{unknown}}');expect(content.common[0].id).toBe('shared');expect(JSON.stringify(snapshot)).toBe(original);
});
it('R05 R06 recovery uses captured same-version document and leaves text-only records intact',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'a',type:'heading',text:'Frozen'},{id:'t',type:'table',rows:[['Frozen content']]}];const projected=projectProtocolDocument(doc).steps;const legacy=projected.map(({order,title,description})=>({order,title,description}));
 const step={protocolStepRef:'v1:1',groupKey:'v1',order:1,title:'Frozen',description:''};
 expect(runStepContent({versions:[{protocolVersionId:'v1',stepsJson:legacy,contentJson:doc}]},step).source).toBe('same-version-recovery');
 expect(runStepContent({versions:[{protocolVersionId:'v1',stepsJson:legacy}]},step).source).toBe('legacy-text');
 expect(runStepContent({versions:[{protocolVersionId:'v2',stepsJson:legacy,contentJson:doc}]},step).blocks).toEqual([]);
});

it.each(['heading','heading2','heading3'] as const)('%s binds tables, images and text to the correct step in source order',kind=>{
 const doc=createEmptyProtocolDocument();
 const heading=(id:string,text:string):import('./protocol-document').ProtocolContentBlock=>kind==='heading'?{id,type:'heading',text}:{id,type:'rich_text',nodes:[{type:kind,content:[{text}]}]};
 doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'prep',type:'text',text:'Shared preparation'},heading('a','A'),{id:'ta',type:'table',rows:[['Table A']]},{id:'img',type:'media',mediaType:'image',url:'/a.png'},{id:'list',type:'rich_text',nodes:[{type:'bullet',content:[{text:'A list'}]}]},{id:'note',type:'text',text:'A note'},heading('b','B'),{id:'tb',type:'table',rows:[['Table B']]}];
 const projection=projectProtocolDocument(doc);
 expect(projection.steps.map(s=>s.title)).toEqual(['A','B']);
 expect(projection.steps[0].content_blocks?.map(b=>b.id)).toEqual(['ta','img','list:0','note']);
 expect(projection.steps[1].content_blocks?.map(b=>b.id)).toEqual(['tb']);
 expect(projection.commonBlocks.map(b=>b.id)).toEqual(['prep']);
 const source={versions:[{protocolVersionId:'v',stepsJson:projection.steps,contentJson:doc}]};
 const s=projection.steps[1];const resolved=runStepContent(source,{protocolStepRef:'v:'+s.source_ref,groupKey:'v',order:2,title:'B',description:''});
 expect(resolved.common.map(b=>b.id)).toEqual(['prep']);expect(JSON.stringify({blocks:resolved.blocks,common:resolved.common})).not.toContain('Table A');
});
it('recovers a v1.2 rich heading with missing table from its frozen source ID, never as shared preparation',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'h',type:'rich_text',nodes:[{type:'heading2',content:[{text:'Old heading'}]}]},{id:'t',type:'table',rows:[['Frozen table']]}];
 const old=[{order:1,title:'Old heading',description:'',source_ref:'h:0',content_blocks:[{id:'h:0',type:'rich_text',nodes:[{type:'heading2',content:[{text:'Old heading'}]}]}]}];
 const r=runStepContent({versions:[{protocolVersionId:'v',stepsJson:old,contentJson:doc}]},{protocolStepRef:'v:h:0',groupKey:'v',order:1,title:'Old heading',description:''});
 expect(r.blocks.map(b=>b.id)).toEqual(['t']);expect(r.common).toEqual([]);
});

it('offline image manifest deduplicates only frozen local attachment images',()=>{const image=(url:string)=>({type:'media',mediaType:'image',url});expect(runOfflineImagePaths({versions:[{blocks:[image('/api/attachments/a?inline=1'),image('/api/attachments/a?inline=1'),image('https://outside.test/private.png'),image('/api/mobile/calculations'),{type:'media',mediaType:'video',url:'/api/attachments/movie'}]}]})).toEqual(['/api/attachments/a?inline=1']);});

it('restores a legacy heading-plus-checklist contract without changing its saved step identity',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[
  {id:'a',type:'heading',text:'1. Prepare'}, {id:'ca',type:'checklist',items:['Add buffer','Mix']},
  {id:'b',type:'heading',text:'2. Prepare'}, {id:'tb',type:'table',rows:[['Component','Volume'],['DNA','2 µL']]}, {id:'cb',type:'checklist',items:['Add DNA']},
 ];
 const snapshot={versions:[{protocolVersionId:'v',contentJson:doc,stepsJson:[{order:1,title:'Prepare',description:'Add buffer\nMix'},{order:2,title:'Prepare',description:'Add DNA'}]}]};
 const step={protocolStepRef:'v:2',groupKey:'v',order:2,title:'Prepare',description:'Add DNA'};
 const before=JSON.stringify(snapshot);
 expect(runStepContent(snapshot,step).blocks.map(b=>b.id)).toEqual(['tb','cb']);
 expect(JSON.stringify(snapshot)).toBe(before);
});
it('keeps frozen material tables reachable even when an old step cannot be recovered',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='material')!.blocks=[{id:'material',type:'table',rows:[['Reagent','µL'],['Buffer','{{dose}}']]}];
 const r=runStepContent({versions:[{protocolVersionId:'v',contentJson:doc,stepsJson:[]}]},{protocolStepRef:'v:9',groupKey:'v',order:9,title:'Unknown',description:'Saved text'},{dose:7});
 expect(r.reference.find(s=>s.key==='material')?.blocks).toEqual([{id:'material',type:'table',rows:[['Reagent','µL'],['Buffer','7']]}]);
 expect(r.source).toBe('legacy-text');expect(r.blocks).toEqual([]);
});

it('identifies confirmation hierarchy only from frozen checklist identity',async()=>{
 const {runStepIsConfirmation}=await import('./run-step-content');
 const doc={schemaVersion:1,sections:[{key:'steps',title:'Steps',blocks:[{id:'heading',type:'heading',text:'Confirm'},{id:'checks',type:'checklist',items:['Confirm']}]}]};
 const projected=projectProtocolDocument(protocolDocumentSchema.parse(doc));
 const snapshot={versions:[{protocolVersionId:'v',stepsJson:projected.steps,contentJson:doc}]};
 expect(runStepIsConfirmation(snapshot,{groupKey:'v',protocolStepRef:'v:checks:0'})).toBe(true);
 expect(runStepIsConfirmation(snapshot,{groupKey:'v',protocolStepRef:'v:heading'})).toBe(false);
});

it('keeps numbered item details in its existing Run step',()=>{
 const doc=protocolDocumentSchema.parse({schemaVersion:1,sections:[{key:'steps',title:'Steps',blocks:[{id:'numbered',type:'rich_text',nodes:[{type:'numbered',content:[{text:'Prepare'}],childContent:[{type:'paragraph',content:[{type:'text',text:'Critical dose 5 µL'}]}]}]}]}]});
 const projection=projectProtocolDocument(doc);expect(projection.steps).toHaveLength(1);expect(projection.steps[0].source_ref).toBe('numbered:0');expect(JSON.stringify(projection.steps[0].content_blocks)).toContain('Critical dose 5 µL');
});

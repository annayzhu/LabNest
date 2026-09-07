import {it,expect} from 'vitest';
import {createEmptyProtocolDocument,projectProtocolDocument} from './protocol-document';
import {buildProtocolExperimentSteps} from './experiment-planning';
import {runStepContent} from './run-step-content';
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

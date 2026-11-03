import { describe, expect, it } from 'vitest';
import { mergeQpcrOutput, type QpcrOutputBlock } from './qpcr-workflow';
import type { ScientificDocument } from './scientific-document';
const doc = (): ScientificDocument => ({ schemaVersion: 1, sections: [{ key: 'custom', title: 'Observations', blocks: [{id:'note',type:'text',text:'Human observation'}] }] });
const output: QpcrOutputBlock = {id:'artifact-a',type:'qpcr',label:'qPCR 分析',toolId:'qpcr-analysis',revision:1,submissionId:'submit-a',sessionAttachmentId:'session-a',images:[],table:{headers:['Sample','Value'],rows:[['S1','2']]},method:'Technical replicates'};
describe('qPCR output in the current record', () => {
  it('adds analysis without replacing custom sections or human text; replay inserts once', () => {
    const first = mergeQpcrOutput(doc(), output, 'analysis', 0);
    expect(first.sections[0]).toEqual(doc().sections[0]);
    expect(first.sections[1].blocks).toEqual([output]);
    expect(mergeQpcrOutput(first, output, 'analysis', 0)).toEqual(first);
  });
});
it('updates one output, preserves neighboring text, and rejects stale revisions', () => {
  const first = mergeQpcrOutput(doc(),output,'analysis',0);
  first.sections[1].blocks.push({id:'conclusion',type:'text',text:'My conclusion'});
  const updated = {...output,revision:2,submissionId:'submit-b'};
  const next = mergeQpcrOutput(first,updated,'analysis',1);
  expect(next.sections[1].blocks).toEqual([updated,{id:'conclusion',type:'text',text:'My conclusion'}]);
  expect(() => mergeQpcrOutput(next,{...output,submissionId:'submit-c'},'analysis',1)).toThrow('此结果已有新版本');
});
it('merges independent paragraphs while detecting concurrent edits to the same paragraph', async () => {
  const { mergeQpcrDocumentDraft } = await import('./qpcr-workflow');
  const base = doc();
  const local = doc(); local.sections[0].blocks.push({id:'local',type:'text',text:'Unsaved observation'});
  const remote = mergeQpcrOutput(base,output,'analysis',0);
  expect(mergeQpcrDocumentDraft(base,local,remote).sections.flatMap(s=>s.blocks).map(b=>b.id)).toEqual(['note','local','artifact-a']);
  remote.sections[0].blocks[0] = {id:'note',type:'text',text:'Other window'};
  local.sections[0].blocks[0] = {id:'note',type:'text',text:'This window'};
  expect(() => mergeQpcrDocumentDraft(base,local,remote)).toThrow();
});
it('reopens an output in a custom template without losing custom sections', async () => {
  const { normalizeScientificDocument, resultSections } = await import('./scientific-document');
  const saved = mergeQpcrOutput(doc(),output,'analysis',0);
  const reopened = normalizeScientificDocument(saved,resultSections);
  expect(reopened.sections.find(section=>section.key==='custom')).toEqual(doc().sections[0]);
  expect(reopened.sections.find(section=>section.key==='analysis')?.blocks).toEqual([output]);
});

import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { createEmptyProtocolDocument, projectProtocolDocument, protocolDocumentSchema } from './protocol-document';
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from './protocol-tiptap';
import { notesAmongSteps } from './protocol-execution';

const stepsSection = (json: JSONContent) => json.content!.find(node => node.attrs?.sectionKey === 'steps')!;

const stepBlocks = () => protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), sections: [{ key: 'steps', title: 'Steps', blocks: [
  { id: 'intro', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '以下用量为 1 个样本。' }] }], execution: { role: 'info' } },
  { id: 's1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '去培养液并原位裂解。', bold: true }, { text: '加入 200 µL，20–25 °C。' }] }], execution: { role: 'step', stepId: 'step-a', format: 'block' } },
  { id: 's1-list', type: 'rich_text', nodes: [{ type: 'bullet', content: [{ text: '轻柔吹打' }] }, { type: 'bullet', content: [{ text: '核对管号' }] }], execution: { role: 'detail', stepId: 'step-a' } },
  { id: 's1-table', type: 'table', rows: [['规格', '用量'], ['6 孔板', '200 µL']], execution: { role: 'detail', stepId: 'step-a' } },
  { id: 's2', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '室温放置 5 min。确认分管关系' }] }], execution: { role: 'step', stepId: 'step-b', format: 'block' } },
  { id: 's2-check', type: 'checklist', items: ['标记管号', '放回冰上'], execution: { role: 'detail', stepId: 'step-b' } },
  { id: 's3', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '离心' }] }], execution: { role: 'step', stepId: 'step-c', format: 'block' } },
] }] });

describe('Step blocks (one block = one operation)', () => {
  it('projects each step block as exactly one operation whose short label never repeats or removes its body', () => {
    const result = projectProtocolDocument(stepBlocks());
    expect(result.executionNeedsReview).toBe(false);
    expect(result.steps.map(step => step.source_ref)).toEqual(['step-a', 'step-b', 'step-c']);
    expect(result.steps.map(step => step.title)).toEqual(['去培养液并原位裂解', '室温放置 5 min', '离心']);
    expect(result.steps.every(step => step.title_source === 'derived')).toBe(true);
    expect(result.steps.map(step => step.content_blocks?.map(block => block.id))).toEqual([['s1', 's1-list', 's1-table'], ['s2', 's2-check'], ['s3']]);
    expect(JSON.stringify(result.steps[2].content_blocks)).toContain('离心');
    expect(result.commonBlocks.map(block => block.id)).toEqual(['intro']);
  });

  it('keeps notes written between steps in their place, and passes a hidden step\'s notes on to the next shown step', () => {
    const document = stepBlocks();
    const blocks = document.sections[0].blocks;
    const note = (id: string, text: string) => ({ id, type: 'rich_text' as const, nodes: [{ type: 'paragraph' as const, content: text ? [{ text }] : [] }], execution: { role: 'info' as const } });
    blocks.splice(4, 0, note('ice', '注：以下步骤在冰上操作。'), note('blank', ''));
    blocks.push(note('store', '完成后 −80 °C 保存。'));
    const result = projectProtocolDocument(document);
    // An empty line between steps is not a note.
    expect(result.commonBlocks.map(block => block.id)).toEqual(['intro', 'ice', 'store']);
    expect(result.notePlacement).toEqual({ intro: 'step-a', ice: 'step-b', store: null });
    const order = result.steps.map(step => step.source_ref!);
    const placed = notesAmongSteps(result.commonBlocks, result.notePlacement, order);
    expect([...placed.before].map(([ref, notes]) => [ref, notes.map(n => n.id)])).toEqual([['step-a', ['intro']], ['step-b', ['ice']]]);
    expect(placed.after.map(n => n.id)).toEqual(['store']);
    // Step b does not apply to this run: "以下步骤…" still reads before the next step shown.
    expect(notesAmongSteps(result.commonBlocks, result.notePlacement, order, ref => ref !== 'step-b').before.get('step-c')?.map(n => n.id)).toEqual(['ice']);
    // No step after it is shown: the note follows the last shown step.
    expect(notesAmongSteps(result.commonBlocks, result.notePlacement, order, ref => ref === 'step-a').after.map(n => n.id)).toEqual(['ice', 'store']);
  });

  it('shortens a long first sentence by what readers see, never cutting a chip reference', () => {
    const id = 'p-4cd81fa1-0ac3-4294-a9e3-2e66b0aaf9cf';
    const document = createEmptyProtocolDocument();
    document.sections.find(section => section.key === 'steps')!.blocks = [
      { id: 'a', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: `加入 {{${id}}} Proteinase K，涡旋混匀。` }] }], execution: { role: 'step', stepId: 'a', format: 'block' } },
      { id: 'b', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: `加入裂解液后上下颠倒混匀十次再离心然后弃去上清液并加入洗涤缓冲液静置十分钟后再次离心并检查沉淀是否完整 {{${id}}} 后继续` }] }], execution: { role: 'step', stepId: 'b', format: 'block' } },
    ];
    const [short, long] = projectProtocolDocument(document).steps.map(step => step.title);
    expect(short).toBe(`加入 {{${id}}} Proteinase K，涡旋混匀`);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\{\{[^}]*…/);
  });

  it('opens each step as one editable step block and saves it back with the same identity and body', () => {
    const json = protocolDocumentToTiptap(stepBlocks());
    const section = stepsSection(json);
    expect(section.content!.map(node => node.type)).toEqual(['paragraph', 'protocolStep', 'protocolStep', 'protocolStep']);
    expect(section.content!.filter(node => node.type === 'protocolStep').map(node => node.attrs?.stepId)).toEqual(['step-a', 'step-b', 'step-c']);
    expect(section.content![1].content!.map(node => node.type)).toEqual(['paragraph', 'bulletList', 'table']);

    const saved = tiptapToProtocolDocument(json);
    const result = projectProtocolDocument(saved);
    expect(result.executionNeedsReview).toBe(false);
    expect(result.steps.map(step => [step.source_ref, step.title])).toEqual([['step-a', '去培养液并原位裂解'], ['step-b', '室温放置 5 min'], ['step-c', '离心']]);
    expect(result.steps[0].content_blocks?.map(block => block.id)).toEqual(['s1', 's1-list', 's1-table']);
    expect(result.commonBlocks.map(block => block.id)).toEqual(['intro']);
  });

  it("keeps a step's own title and confirmation settings through save and reopen", () => {
    const document = stepBlocks();
    const blocks = document.sections.find(section => section.key === 'steps')!.blocks;
    blocks[4] = { ...blocks[4], execution: { role: 'step', stepId: 'step-b', format: 'block', title: '室温静置', requiresConfirmation: false, allowsDeviation: false } };
    const saved = tiptapToProtocolDocument(protocolDocumentToTiptap(document));
    const step = projectProtocolDocument(saved).steps.find(item => item.source_ref === 'step-b')!;
    expect(step).toMatchObject({ title: '室温静置', requires_confirmation: false, allows_deviation: false });
    expect(step.title_source).toBeUndefined();
  });

  it('saves a step typed in the editor, and an unmarked note beside the steps, without asking to organize steps', () => {
    const json = protocolDocumentToTiptap(createEmptyProtocolDocument());
    stepsSection(json).content = [
      { type: 'paragraph', content: [{ type: 'text', text: '全程在冰上操作。' }] },
      { type: 'protocolStep', attrs: { stepId: 'step-new' }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: '加样' }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '核对管号' }] }] }] },
      ] },
      { type: 'protocolStep', attrs: { stepId: 'step-empty' }, content: [{ type: 'paragraph' }] },
    ];
    const result = projectProtocolDocument(tiptapToProtocolDocument(json));
    expect(result.executionNeedsReview).toBe(false);
    expect(result.steps.map(step => step.source_ref)).toEqual(['step-new']);
    expect(result.steps[0].content_blocks).toHaveLength(2);
    expect(result.commonBlocks).toHaveLength(1);
  });
});

describe('A thermocycler program card inside a step', () => {
  const pcr = { id: 'pcr', type: 'program', label: 'PCR 程序', stages: [
    { id: 's1', cycles: 1, steps: [{ id: 'd', temperatureC: 95, seconds: 180 }] },
    { id: 's2', cycles: 35, steps: [{ id: 'a', temperatureC: 95, seconds: 15 }, { id: 'b', temperatureC: 60, seconds: 30 }, { id: 'c', temperatureC: 72, seconds: 30 }] },
    { id: 's3', cycles: 1, steps: [{ id: 'h', temperatureC: 4, seconds: null }] }] };
  const document = () => protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), sections: [{ key: 'steps', title: 'Steps', blocks: [
    { id: 'run', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '上机扩增。' }] }], execution: { role: 'step', stepId: 'amplify', format: 'block' } },
    { ...pcr, execution: { role: 'detail', stepId: 'amplify' } }] }] });

  it('keeps every stage through save and reopen and reads as one line in step text', () => {
    const saved = tiptapToProtocolDocument(protocolDocumentToTiptap(document()));
    const step = projectProtocolDocument(saved).steps[0];
    expect(step.content_blocks?.[1]).toMatchObject({ type: 'program', stages: pcr.stages });
    expect(step.description).toContain('PCR 程序：95 °C 3 min；35 个循环（95 °C 15 s → 60 °C 30 s → 72 °C 30 s）；4 °C 保持');
  });
});

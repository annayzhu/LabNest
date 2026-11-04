import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Node } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { KeepLineAfterBlocks, missingLines } from './editor-block-line';
import { scientificDocumentToTiptap, tiptapToMarkdownRichText, markdownRichTextToTiptap, tiptapToScientificDocument } from './scientific-tiptap';
import type { ScientificDocument } from './scientific-document';
import { newPlateLayout, plateLayoutToMarkdown } from './plate-layout';

const widget = (name: string) => Node.create({ name, group: 'block', atom: true, addAttributes: () => ({ block: { default: null } }) });
const section = Node.create({ name: 'scientificSection', group: 'section', content: 'block+', addAttributes: () => ({ sectionKey: { default: '' } }) });
const schema = getSchema([StarterKit, widget('documentTool'), widget('documentPlate'), KeepLineAfterBlocks]);
const p = (text?: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);
const tool = () => schema.nodes.documentTool.create();
const doc = (...nodes: ReturnType<typeof p>[]) => schema.nodes.doc.create(null, nodes);

describe('a line to type on after blocks', () => {
  it('is missing after a last block and between two blocks, and nowhere else', () => {
    expect(missingLines(doc(p('a'), tool(), p('b')))).toEqual([]);
    const one = doc(p('a'), tool());
    expect(missingLines(one)).toEqual([one.content.size]);
    expect(missingLines(doc(tool(), tool(), p('b')))).toEqual([1]);
  });
  it('is added inside each section', () => {
    const sectioned = getSchema([StarterKit.configure({ document: false }), Node.create({ name: 'doc', topNode: true, content: 'section+' }), section, widget('documentTool')]);
    const value = sectioned.nodes.doc.create(null, [sectioned.nodes.scientificSection.create(null, [sectioned.nodes.documentTool.create()])]);
    expect(missingLines(value)).toEqual([2]);
    expect(EditorState.create({ doc: value }).doc.childCount).toBe(1);
  });
});

describe('the empty line saves nothing', () => {
  const document: ScientificDocument = { schemaVersion: 1, sections: [{ key: 'analysis', title: 'Analysis', blocks: [{ id: 'tool', type: 'tool_output', label: 'x', toolId: 'calculator', revision: 1, submissionId: 's', sessionAttachmentId: 'a', images: [], table: { headers: [], rows: [] }, method: 'm' }] }] };
  it('in a record document', () => {
    const json = scientificDocumentToTiptap(document);
    json.content![0].content!.push({ type: 'paragraph' });
    expect(tiptapToScientificDocument(json, document)).toEqual(document);
  });
  it('at the end of an Entry', () => {
    const line = plateLayoutToMarkdown(newPlateLayout({ id: 'p', name: 'p', fieldNames: ['样本', '处理'] }));
    const json = markdownRichTextToTiptap(`note\n${line}`);
    json.content!.push({ type: 'paragraph' });
    expect(tiptapToMarkdownRichText(json).trim()).toBe(`note\n${line}`);
  });
});

import { describe, expect, it } from 'vitest';
import { getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { AllSelection, EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { clearSelectionInSections, keepSections, onlySections, spansSections, withoutSections } from './document-sections';
import { createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from './tiptap-document-extensions';
import { ProtocolDocumentNode } from './protocol-document-node';
import { ProtocolStepNode } from './protocol-step-node';
import { ScientificDocumentNode } from './scientific-document-node';
import { normalizeScientificDocument, parseScientificDocumentJson } from './scientific-document';
import { tiptapTableRows } from './tiptap-table-serialization';
import { createDayBreakExtension, deleteAroundBreaks, fillEmptyDays } from './editor-day-breaks';

const noView = () => ({ dom: { nodeType: 1 } as unknown as HTMLElement });
const section = (name: string, content?: string) => createDocumentSectionExtension({ name, tag: `section[data-${name}]`, content, attributes: { sectionKey: { default: 'x', htmlAttribute: `data-${name}` } }, nodeView: noView });
const shared = [StarterKit.configure({ document: false, link: false, trailingNode: false, codeBlock: false, horizontalRule: false }), TaskList, TaskItem, createResizableDocumentTableExtension()];

/** Experiment, result, plan and report documents, and Protocols: both use the shared section node. */
const editors: Array<[string, Schema, string]> = [
  ['record', getSchema([...shared, ScientificDocumentNode, section('scientificSection'), createDocumentWidgetExtension({ name: 'scientificWidget', htmlAttribute: 'data-w', nodeView: noView })]), 'scientificSection'],
  ['Protocol', getSchema([...shared, ProtocolDocumentNode, ProtocolStepNode, section('protocolSection', '(block | protocolStep)*'), createDocumentWidgetExtension({ name: 'protocolWidget', htmlAttribute: 'data-w', nodeView: noView })]), 'protocolSection'],
];

const lines = ['Cells A control', 'Cells A knockdown 1', 'Cells A knockdown 2'];
const paragraph = (text?: string): JSONContent => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const table = (cell: JSONContent[] = [paragraph()]): JSONContent => ({ type: 'table', content: [
  { type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph('Medium 1')] }, { type: 'tableHeader', content: [paragraph('Medium 2')] }] },
  { type: 'tableRow', content: [{ type: 'tableCell', content: cell }, { type: 'tableCell', content: [paragraph()] }] },
] });

function allOfType(doc: ProseMirrorNode, type: string) {
  const found: Array<{ pos: number; node: ProseMirrorNode; depth: number }> = [];
  doc.descendants((node, pos) => { if (node.type.name === type) found.push({ pos, node, depth: doc.resolve(pos).depth }); });
  return found;
}
const allText = (doc: ProseMirrorNode) => doc.textBetween(0, doc.content.size, '\n', '\n');

describe.each(editors)('fixed sections in a %s document', (_label, schema, sectionType) => {
  const build = (first: JSONContent[], second: JSONContent[] = [paragraph()]) => schema.nodeFromJSON({ type: 'doc', content: [
    { type: sectionType, attrs: { sectionKey: 'setup' }, content: first },
    { type: sectionType, attrs: { sectionKey: 'results' }, content: second },
  ] });
  /** The selected lines of the first section, as Copy puts them on the clipboard. */
  const copyLines = (state: EditorState) => {
    const start = 2, end = state.doc.child(0).content.size;
    return TextSelection.create(state.doc, start, end).content();
  };
  /** Paste the slice with the caret at `pos`, the way ProseMirror does. */
  const pasteAt = (state: EditorState, pos: number, slice: ReturnType<typeof copyLines>) => {
    const placed = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
    return placed.apply(placed.tr.replaceSelection(withoutSections(slice, sectionType))).doc;
  };
  const sectionLines = lines.map(paragraph);

  it('stay at the top level when copied lines land on an empty table cell', () => {
    const state = EditorState.create({ schema, doc: build(sectionLines, [table(), paragraph()]) });
    const cell = allOfType(state.doc, 'tableCell')[0];
    const after = pasteAt(state, cell.pos + 2, copyLines(state));
    expect(allOfType(after, sectionType).every(found => found.depth === 0)).toBe(true);
    expect(allOfType(after, sectionType)).toHaveLength(2);
    expect(allText(after)).toContain(lines.join('\n'));
  });

  it.each([
    ['an empty line in another section', [paragraph()], (doc: ProseMirrorNode) => doc.child(0).nodeSize + 2],
    ['an empty quote', [{ type: 'blockquote', content: [paragraph()] }], (doc: ProseMirrorNode) => doc.child(0).nodeSize + 3],
    ['an empty list item', [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph()] }] }], (doc: ProseMirrorNode) => doc.child(0).nodeSize + 4],
  ] as Array<[string, JSONContent[], (doc: ProseMirrorNode) => number]>)('stay at the top level when copied lines land on %s', (_where, second, caret) => {
    const state = EditorState.create({ schema, doc: build(sectionLines, second) });
    const after = pasteAt(state, caret(state.doc), copyLines(state));
    expect(allOfType(after, sectionType).every(found => found.depth === 0)).toBe(true);
    expect(allText(after)).toContain(lines.at(-1));
  });

  it('lose no line when a selection across two sections lands on an empty cell', () => {
    const doc = build([paragraph('first section')], [paragraph('second section'), table()]);
    const state = EditorState.create({ schema, doc });
    const slice = TextSelection.create(doc, 2, doc.child(0).nodeSize + 2 + 'second section'.length).content();
    const after = pasteAt(state, allOfType(doc, 'tableCell')[0].pos + 2, slice);
    expect(allOfType(after, sectionType).every(found => found.depth === 0)).toBe(true);
    const cellText = allOfType(after, 'tableCell')[0].node.textBetween(0, allOfType(after, 'tableCell')[0].node.content.size, '\n', '\n');
    expect(cellText).toContain('first section');
    expect(cellText).toContain('second section');
  });

  describe('deleting over several sections', () => {
    const remove = (state: EditorState) => {
      expect(spansSections(state)).toBe(true);
      return state.apply(clearSelectionInSections(state));
    };
    it('keeps both sections and clears what was selected, for select all', () => {
      const doc = build([paragraph('keep nothing')], [paragraph('nor this')]);
      const state = EditorState.create({ schema, doc, selection: new AllSelection(doc) });
      const after = remove(state).doc;
      expect(allOfType(after, sectionType).map(found => found.node.attrs.sectionKey)).toEqual(['setup', 'results']);
      expect(allText(after).trim()).toBe('');
    });
    it('keeps both sections for a selection from one into the next', () => {
      const doc = build([paragraph('stays'), paragraph('goes')], [paragraph('goes too'), paragraph('stays too')]);
      const from = 2 + 'stays'.length + 2 + 1, to = doc.child(0).nodeSize + 2 + 'goes too'.length;
      const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, from, to) });
      const after = remove(state).doc;
      expect(allOfType(after, sectionType).map(found => found.node.attrs.sectionKey)).toEqual(['setup', 'results']);
      expect(allText(after)).toContain('stays');
      expect(allText(after)).toContain('stays too');
      expect(allText(after)).not.toContain('goes too');
    });
    it('leaves a line to write on in a section selected whole', () => {
      const doc = build([paragraph('all of it')]);
      const after = remove(EditorState.create({ schema, doc, selection: NodeSelection.create(doc, 0) })).doc;
      expect(after.child(0).childCount).toBe(1);
      expect(after.child(0).textContent).toBe('');
      expect(allOfType(after, sectionType)).toHaveLength(2);
    });
    it('does not apply to a selection inside one section', () => {
      const doc = build([paragraph('one'), paragraph('two')]);
      expect(spansSections(EditorState.create({ schema, doc, selection: TextSelection.create(doc, 2, 8) }))).toBe(false);
    });
  });

  describe('any other edit that would change the sections', () => {
    const told: string[] = [];
    const plugins = [keepSections(sectionType, text => { told.push(text); })];
    it('does not happen, and says why', () => {
      const doc = build([paragraph('one')], [paragraph('two')]);
      const state = EditorState.create({ schema, doc, plugins });
      const after = state.applyTransaction(state.tr.delete(4, doc.child(0).nodeSize + 3));
      expect(after.state.doc.eq(doc)).toBe(true);
      expect(told.at(-1)).toContain('fixed sections');
    });
    it('lets saved content through, which may show other sections', () => {
      const doc = build([paragraph('one')], [paragraph('two')]);
      const state = EditorState.create({ schema, doc, plugins });
      const saved = schema.nodeFromJSON({ type: 'doc', content: [{ type: sectionType, attrs: { sectionKey: 'setup' }, content: [paragraph('new')] }] });
      const after = state.apply(state.tr.replaceWith(0, doc.content.size, saved.content).setMeta('preventUpdate', true));
      expect(after.doc.childCount).toBe(1);
    });
    it('lets ordinary edits through', () => {
      const doc = build([paragraph('one')]);
      const state = EditorState.create({ schema, doc, plugins });
      expect(state.apply(state.tr.insertText('x', 2)).doc.child(0).textContent).toBe('xone');
    });
  });
});

describe('a section an older version pasted into a table cell', () => {
  const nested: JSONContent[] = [{ type: 'scientificSection', attrs: { sectionKey: 'setup', sectionTitle: 'Setup & samples' }, content: lines.map(paragraph) }];
  it('opens as its lines, with no section left to delete', () => {
    const [, row] = tiptapTableRows({ rows: [['a', 'b'], [lines.join('\n'), '']], cellRichContent: [[null, null], [nested, null]] });
    const cell = row.content![0];
    expect(cell.content?.map(node => node.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(cell.content?.map(node => node.content?.[0].text)).toEqual(lines);
  });
  it('keeps whatever else the cell holds', () => {
    const mixed: JSONContent[] = [paragraph('before'), ...nested];
    const [row] = tiptapTableRows({ rows: [['x']], cellRichContent: [[mixed]] });
    expect(row.content![0].content).toHaveLength(4);
  });
});

describe('saving a document', () => {
  const definitions = [{ key: 'setup', title: 'Setup' }];
  it('refuses content it cannot read, rather than saving an empty document over the record', () => {
    const broken = JSON.stringify({ schemaVersion: 1, sections: [{ key: 'setup', title: 'Setup', blocks: [{ id: 'x', type: 'not-a-block' }] }] });
    expect(() => parseScientificDocumentJson(broken, definitions)).toThrow('nothing was saved');
    expect(normalizeScientificDocument(JSON.parse(broken), definitions).sections[0].blocks).toEqual([]);
  });
  it('still accepts an empty field and a good document', () => {
    expect(parseScientificDocumentJson('', definitions).sections[0].blocks).toEqual([]);
    const good = JSON.stringify({ schemaVersion: 1, sections: [{ key: 'setup', title: 'Setup', blocks: [{ id: 'x', type: 'heading', text: 'Hello' }] }] });
    expect(parseScientificDocumentJson(good, definitions).sections[0].blocks).toHaveLength(1);
  });
});

describe('Backspace and Delete at the edge of a section', () => {
  const schema = editors[0][1];
  const told: string[] = [];
  const plugin = keepSections('scientificSection', text => { told.push(text); });
  const section = (key: string, content: JSONContent[]) => ({ type: 'scientificSection', attrs: { sectionKey: key }, content });
  /** Press the key with the caret at `pos`; what the editor did, and whether the key was dealt with here. */
  const press = (json: JSONContent[], pos: number, key: 'Backspace' | 'Delete', repeat = false) => {
    told.length = 0;
    const doc = schema.nodeFromJSON({ type: 'doc', content: json });
    let state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos), plugins: [plugin] });
    const view = { get state() { return state; }, dispatch(tr: Parameters<EditorState['apply']>[0]) { state = state.apply(tr); } };
    const handled = plugin.props.handleKeyDown!.call(plugin, view as never, { key, repeat, isComposing: false, metaKey: false, ctrlKey: false, altKey: false } as KeyboardEvent);
    return { handled, doc: state.doc, told: [...told] };
  };
  const twoSections = [section('setup', [paragraph('one'), paragraph('two')]), section('results', [paragraph('three')])];

  it('says why at the top of a section and changes nothing', () => {
    const { handled, doc, told: said } = press(twoSections, 2, 'Backspace');
    expect(handled).toBe(true);
    expect(doc.toJSON()).toEqual(schema.nodeFromJSON({ type: 'doc', content: twoSections }).toJSON());
    expect(said[0]).toContain('Section titles');
  });
  it('says nothing while the key is held down, as when erasing a line', () => {
    expect(press(twoSections, 2, 'Backspace', true).told).toEqual([]);
  });
  it('says why at the end of a section with another after it, and nothing at the end of the last', () => {
    const end = schema.nodeFromJSON({ type: 'doc', content: twoSections }).child(0).nodeSize - 2;
    expect(press(twoSections, end, 'Delete').told[0]).toContain('end of the section');
    const last = schema.nodeFromJSON({ type: 'doc', content: twoSections }).content.size - 2;
    expect(press(twoSections, last, 'Delete')).toMatchObject({ handled: true, told: [] });
  });
  it('removes an empty first line with lines below it', () => {
    const { handled, doc } = press([section('setup', [paragraph(), paragraph('two')])], 2, 'Backspace');
    expect(handled).toBe(true);
    expect(doc.child(0).childCount).toBe(1);
    expect(doc.child(0).textContent).toBe('two');
  });
  it('leaves other lines to the editor: a second line, and the second item of a list at the top', () => {
    expect(press(twoSections, 7, 'Backspace').handled).toBe(false);
    const list = [section('setup', [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('a')] }, { type: 'listItem', content: [paragraph('b')] }] }])];
    expect(press(list, 8, 'Backspace').handled).toBe(false);
  });
  it('lets a list or quote at the very top lift out of itself', () => {
    const list = [section('setup', [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('a')] }] }])];
    expect(press(list, 4, 'Backspace').handled).toBe(false);
  });
  it('holds at the first cell of a table at the top, and leaves any other cell to the editor', () => {
    const cellDoc = [section('setup', [table([paragraph('x')])])];
    expect(press(cellDoc, 5, 'Backspace').handled).toBe(true);
    const later = schema.nodeFromJSON({ type: 'doc', content: cellDoc });
    let cell = 0;
    later.descendants((node, pos) => { if (node.type.name === 'tableCell' && !cell) cell = pos; });
    expect(press(cellDoc, cell + 2, 'Backspace').handled).toBe(false);
  });
});

describe('which documents hold only sections', () => {
  it('is records and Protocols, never an Entry', () => {
    for (const [, schema] of editors) expect(onlySections(EditorState.create({ schema }))).toBe(true);
    expect(onlySections(EditorState.create({ schema: getSchema([StarterKit]) }))).toBe(false);
  });
  it('never lets a click select a whole section', () => {
    for (const [, schema, sectionType] of editors) expect(schema.nodes[sectionType].spec.selectable).toBe(false);
  });
});

describe('the days of 执行记录 in a cleared selection', () => {
  const schema = getSchema([...shared, ScientificDocumentNode, section('scientificSection'), createDayBreakExtension(noView)]);
  const day = (dayKey: string): JSONContent => ({ type: 'scientificDayBreak', attrs: { dayKey } });
  const doc = schema.nodeFromJSON({ type: 'doc', content: [
    { type: 'scientificSection', attrs: { sectionKey: 'setup' }, content: [paragraph('Setup line')] },
    { type: 'scientificSection', attrs: { sectionKey: 'execution' }, content: [day('2026-11-09'), paragraph('Day one note'), day('2026-11-10'), paragraph('Day two note'), day('')] },
  ] });
  const days = (node: ProseMirrorNode) => allOfType(node, 'scientificDayBreak').map(found => found.node.attrs.dayKey);

  it('keeps every day when everything is selected and deleted', () => {
    const state = EditorState.create({ doc, selection: new AllSelection(doc) });
    const after = state.apply(clearSelectionInSections(state)).doc;
    expect(days(after)).toEqual(['2026-11-09', '2026-11-10', '']);
    expect(allText(after).replace(/\n/g, '')).toBe('');
    // Each day keeps its line in the same step, so nothing is added afterwards that undo would leave behind.
    const execution = after.child(1), kinds: string[] = [];
    execution.forEach(node => { kinds.push(node.type.name); });
    expect(kinds).toEqual(['scientificDayBreak', 'paragraph', 'scientificDayBreak', 'paragraph', 'scientificDayBreak', 'paragraph']);
    expect(allOfType(after, 'scientificSection')).toHaveLength(2);
  });

  it('clears a selection from 执行记录 into a later section when a day has nothing written yet', () => {
    const later = schema.nodeFromJSON({ type: 'doc', content: [
      { type: 'scientificSection', attrs: { sectionKey: 'setup' }, content: [paragraph('Setup line')] },
      { type: 'scientificSection', attrs: { sectionKey: 'execution' }, content: [day('2026-11-09'), day('2026-11-10'), paragraph('Keep this, then drop this')] },
      { type: 'scientificSection', attrs: { sectionKey: 'results' }, content: [paragraph('Result line')] },
    ] });
    const all = EditorState.create({ doc: later, selection: new AllSelection(later) });
    const cleared = all.apply(clearSelectionInSections(all)).doc;
    expect(days(cleared)).toEqual(['2026-11-09', '2026-11-10']);
    expect(allOfType(cleared, 'scientificSection').map(found => found.node.attrs.sectionKey)).toEqual(['setup', 'execution', 'results']);
    expect(allText(cleared).replace(/\n/g, '')).toBe('');
    const line = allOfType(later, 'paragraph').find(found => found.node.textContent.startsWith('Keep'))!;
    const from = line.pos + 1 + 'Keep this'.length, to = later.content.size - 2;
    const partial = EditorState.create({ doc: later, selection: TextSelection.create(later, from, to) });
    const after = partial.apply(clearSelectionInSections(partial)).doc;
    expect(days(after)).toEqual(['2026-11-09', '2026-11-10']);
    expect(allText(after)).toContain('Setup line');
    expect(allText(after)).toContain('Keep this');
    expect(allText(after)).not.toContain('drop this');
    const execution: string[] = [];
    after.child(1).forEach(node => { execution.push(node.type.name); });
    expect(execution).toEqual(['scientificDayBreak', 'paragraph', 'scientificDayBreak', 'paragraph']);
  });

  it('deletes around the days inside one section', () => {
    const notes = allOfType(doc, 'paragraph').filter(found => found.node.textContent.startsWith('Day'));
    const tr = fillEmptyDays(deleteAroundBreaks(EditorState.create({ doc }).tr, notes[0].pos, notes[1].pos + notes[1].node.nodeSize));
    expect(days(tr.doc)).toEqual(['2026-11-09', '2026-11-10', '']);
    expect(allText(tr.doc)).not.toMatch(/Day/);
  });
});

import { describe, expect, it } from 'vitest';
import { getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { createDocumentSectionExtension } from './tiptap-document-extensions';
import { joinProtocolStepBackward, protocolStepPlacement, ProtocolStepNode, splitProtocolStep } from './protocol-step-node';

const schema = getSchema([StarterKit, ProtocolStepNode, createDocumentSectionExtension({ name: 'protocolSection', tag: 'section[data-protocol-section]', attributes: { sectionKey: { default: 'steps', htmlAttribute: 'data-protocol-section' } }, nodeView: undefined as never, content: '(block | protocolStep)*' })]);
const paragraph = (text = ''): JSONContent => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const step = (stepId: string | null, ...content: JSONContent[]): JSONContent => ({ type: 'protocolStep', attrs: { stepId }, content });
const steps = (...content: JSONContent[]) => ({ type: 'doc', content: [{ type: 'protocolSection', attrs: { sectionKey: 'steps' }, content }] });
/** Place the cursor just before `marker`'s text offset inside the first text containing it. */
function stateAt(json: JSONContent, text: string, offset: number) {
  const doc = schema.nodeFromJSON(json);
  let position = -1;
  doc.descendants((node, pos) => { if (position < 0 && node.isText && node.text!.includes(text)) position = pos + node.text!.indexOf(text) + offset; });
  return EditorState.create({ doc, selection: TextSelection.create(doc, position) });
}
const run = (state: EditorState, command: typeof joinProtocolStepBackward) => { let next = state; const handled = command(state, tr => { next = state.apply(tr); }); return { handled, next, json: next.doc.toJSON().content[0].content as JSONContent[], cursorText: next.selection.$from.parent.textContent }; };
const outline = (json: JSONContent[]) => json.map(node => node.type === 'protocolStep' ? [node.attrs?.stepId, (node.content ?? []).map(child => child.content?.map(t => t.text).join('') ?? '')] : node.content?.map(t => t.text).join('') ?? '');

describe('Writing steps: Enter makes the next step, Backspace joins it back', () => {
  const written = steps(step('a', paragraph('加入试剂混匀')), step('b', paragraph('离心')));

  it('splits a step at the cursor; the written part keeps its identity and the cursor starts the new step', () => {
    const { json, cursorText } = run(stateAt(written, '混匀', 0), splitProtocolStep());
    expect(outline(json)).toEqual([['a', ['加入试剂']], [null, ['混匀']], ['b', ['离心']]]);
    expect(cursorText).toBe('混匀');
  });

  it('adds an empty step above when Enter is pressed at the start, leaving the written step where it was', () => {
    const { json, cursorText } = run(stateAt(written, '离心', 0), splitProtocolStep());
    expect(outline(json)).toEqual([['a', ['加入试剂混匀']], [null, ['']], ['b', ['离心']]]);
    expect(cursorText).toBe('离心');
  });

  it('leaves the step list when Enter is pressed in an empty step', () => {
    const doc = schema.nodeFromJSON(steps(step('a', paragraph('离心')), step(null, paragraph())));
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, doc.content.size - 3) });
    expect(outline(run(state, splitProtocolStep()).json)).toEqual([['a', ['离心']], '']);
    const only = schema.nodeFromJSON(steps(step('only', paragraph())));
    const onlyState = EditorState.create({ doc: only, selection: TextSelection.create(only, 3) });
    expect(outline(run(onlyState, splitProtocolStep()).json)).toEqual([['only', ['']]]);
  });

  it('turns a quantity typed at the end of the line into a chip before making the next step', () => {
    const doc = steps(step('a', paragraph('孵育 5 min')));
    const chip = { type: 'text', text: '[chip]' };
    const { json } = run(stateAt(doc, '5 min', 5), splitProtocolStep(line => line.endsWith('5 min') ? { length: 5, chip } : null));
    expect(outline(json)).toEqual([['a', ['孵育 [chip]']], [null, ['']]]);
  });

  it('joins a step into the one above on Backspace, and leaves the list from the first step', () => {
    expect(outline(run(stateAt(written, '离心', 0), joinProtocolStepBackward).json)).toEqual([['a', ['加入试剂混匀离心']]]);
    expect(outline(run(stateAt(written, '加入', 0), joinProtocolStepBackward).json)).toEqual(['加入试剂混匀', ['b', ['离心']]]);
  });

  it('leaves Enter inside a list in a step to the list', () => {
    const doc = steps(step('a', paragraph('加样'), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('核对管号')] }] }));
    expect(run(stateAt(doc, '核对', 2), splitProtocolStep()).handled).toBe(false);
  });
});

describe('Steps belong to the Steps section', () => {
  const sections = (...list: Array<[string, JSONContent[]]>) => ({ type: 'doc', content: list.map(([sectionKey, content]) => ({ type: 'protocolSection', attrs: { sectionKey }, content })) });
  const sectionOutline = (state: EditorState, index: number) => outline(state.doc.toJSON().content[index].content as JSONContent[]);

  it('keeps a step pasted into another section as that section\'s ordinary text', () => {
    const doc = schema.nodeFromJSON(sections(['description', [paragraph('背景')]], ['steps', [step('a', paragraph('离心'))]]));
    const state = EditorState.create({ doc, plugins: [protocolStepPlacement(() => true)] });
    const next = state.apply(state.tr.insert(1 + doc.firstChild!.content.size, schema.nodeFromJSON(step(null, paragraph('混匀')))));
    expect(sectionOutline(next, 0)).toEqual(['背景', '混匀']);
    expect(sectionOutline(next, 1)).toEqual([['a', ['离心']]]);
  });

  it('does not turn older, not yet converted steps into step blocks when one is pasted among them', () => {
    const doc = schema.nodeFromJSON(sections(['steps', [paragraph('1. 加样'), paragraph('2. 离心')]]));
    const state = EditorState.create({ doc, plugins: [protocolStepPlacement(() => false)] });
    const next = state.apply(state.tr.insert(1 + doc.firstChild!.content.size, schema.nodeFromJSON(step(null, paragraph('混匀')))));
    expect(sectionOutline(next, 0)).toEqual(['1. 加样', '2. 离心', '混匀']);
  });
});

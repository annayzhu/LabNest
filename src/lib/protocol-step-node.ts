import { mergeAttributes, Node, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, TextSelection, type Command } from '@tiptap/pm/state';
import { recognizeQuantity } from './protocol-chips';
import { protocolHandlers } from './protocol-editor-extensions';

const stepDepth = ($pos: ResolvedPos) => { for (let depth = $pos.depth; depth > 0; depth -= 1) if ($pos.node(depth).type.name === 'protocolStep') return depth; return -1; };
/** The cursor's line sits directly in a step (not inside one of its lists, quotes or tables). */
const stepLine = ($pos: ResolvedPos) => { const depth = stepDepth($pos); return depth > 0 && $pos.depth === depth + 1 && $pos.parent.isTextblock ? depth : -1; };
const emptyStep = (step: ProseMirrorNode) => step.childCount === 1 && step.firstChild!.isTextblock && step.firstChild!.content.size === 0;

/**
 * Enter makes the next step (Benchling-style); Shift+Enter keeps a line break inside the step.
 * The written part keeps its step identity, so conditions and later records stay with it.
 * `beforeSplit` may turn a quantity typed at the end of the line into a chip in the same transaction.
 */
export const splitProtocolStep = (beforeSplit?: (line: string) => { length: number; chip: JSONContent } | null): Command => (state, dispatch) => {
  const { $from, empty } = state.selection;
  const depth = empty ? stepLine($from) : -1;
  if (depth < 0) return false;
  const step = $from.node(depth), start = $from.before(depth);
  if (!dispatch) return true;
  const tr = state.tr;
  if (emptyStep(step)) {
    // An empty step is a way out of the step list, like an empty list item; the last step stays.
    const section = $from.node(depth - 1);
    let steps = 0;
    section.forEach(child => { if (child.type === step.type) steps += 1; });
    if (steps < 2) return true;
    tr.replaceWith(start, $from.after(depth), step.firstChild!);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, start + 1)).scrollIntoView());
    return true;
  }
  if ($from.parentOffset === 0 && $from.index(depth) === 0) {
    const above = step.type.create({ stepId: null }, state.schema.nodes.paragraph.create());
    tr.insert(start, above);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, $from.pos + above.nodeSize)).scrollIntoView());
    return true;
  }
  let position = $from.pos;
  const atLineEnd = $from.parentOffset === $from.parent.content.size;
  const quantity = atLineEnd ? beforeSplit?.($from.parent.textBetween(0, $from.parentOffset, undefined, '￼')) : null;
  if (quantity) {
    tr.replaceWith(position - quantity.length, position, state.schema.nodeFromJSON(quantity.chip));
    position = tr.mapping.map(position);
  }
  const line = $from.parent;
  tr.split(position, 2, [{ type: step.type, attrs: { stepId: null } }, { type: atLineEnd ? state.schema.nodes.paragraph : line.type }]);
  dispatch(tr.setSelection(TextSelection.create(tr.doc, position + 4)).scrollIntoView());
  return true;
};

/** Backspace at the start of a step joins it to the step above; on the first step it leaves the step list. */
export const joinProtocolStepBackward: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const depth = empty ? stepLine($from) : -1;
  if (depth < 0 || $from.parentOffset !== 0 || $from.index(depth) !== 0) return false;
  if (!dispatch) return true;
  const start = $from.before(depth), previous = state.doc.resolve(start).nodeBefore, tr = state.tr;
  if (previous?.type.name === 'protocolStep' && previous.lastChild?.isTextblock) {
    // Remove the boundary between the previous step's last line and this line.
    tr.delete(start - 2, $from.pos);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, start - 2)).scrollIntoView());
  } else if (previous?.type.name === 'protocolStep') {
    dispatch(tr.join(start).scrollIntoView());
  } else {
    tr.replaceWith(start, $from.after(depth), $from.node(depth).content);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, start + 1)).scrollIntoView());
  }
  return true;
};

/**
 * Steps live only in the Steps section: a step pasted or dragged elsewhere becomes that section's ordinary content.
 * A Steps section still holding older, unconverted steps (`stepsAllowed` false) does not become step blocks by pasting one.
 */
export function protocolStepPlacement(stepsAllowed: () => boolean) {
  return new Plugin({
    appendTransaction(transactions, _old, state) {
      if (!transactions.some(tr => tr.docChanged)) return null;
      const misplaced: Array<{ pos: number; node: ProseMirrorNode }> = [];
      state.doc.forEach((section, offset) => {
        if (section.type.name !== 'protocolSection' || (section.attrs.sectionKey === 'steps' && stepsAllowed())) return;
        section.forEach((child, childOffset) => { if (child.type.name === 'protocolStep') misplaced.push({ pos: offset + 1 + childOffset, node: child }); });
      });
      if (!misplaced.length) return null;
      const tr = state.tr;
      for (const { pos, node } of misplaced.reverse()) tr.replaceWith(pos, pos + node.nodeSize, node.content);
      return tr;
    },
  });
}

/** Enter at the end of "孵育 5 min" makes the quantity a chip before the next step starts. */
const chipAtLineEnd = (editor: Editor) => (line: string) => {
  const quantity = recognizeQuantity(`${line} `), handlers = protocolHandlers(editor);
  if (!handlers || !quantity || quantity.index + quantity.source.length !== line.length) return null;
  const attrs = handlers.createChip(quantity, editor.state.selection.from - quantity.source.length);
  return attrs ? { length: quantity.source.length, chip: { type: 'protocolParameter', attrs } } : null;
};

/** A step's own label and confirmation settings, kept when it is edited (never copied to a step split from it). */
export type ProtocolStepSettings = { title?: string; titlePrefix?: string; requiresConfirmation?: boolean; allowsDeviation?: boolean };

/** One step block = one execution item. Steps never nest; the Steps section numbers them. */
export const ProtocolStepNode = Node.create({
  name: 'protocolStep',
  group: 'protocolStep',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    stepId: { default: null, keepOnSplit: false, parseHTML: element => element.getAttribute('data-protocol-step') || null, renderHTML: attributes => ({ 'data-protocol-step': attributes.stepId ?? '' }) },
    settings: { default: null, keepOnSplit: false,
      parseHTML: element => { try { return JSON.parse(element.getAttribute('data-protocol-step-settings') ?? 'null'); } catch { return null; } },
      renderHTML: attributes => attributes.settings ? { 'data-protocol-step-settings': JSON.stringify(attributes.settings) } : {} },
  }),
  parseHTML: () => [{ tag: 'div[data-protocol-step]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { class: 'ln-protocol-step' }), 0],
  addKeyboardShortcuts() {
    return {
      Enter: () => splitProtocolStep(chipAtLineEnd(this.editor))(this.editor.state, this.editor.view.dispatch),
      Backspace: () => joinProtocolStepBackward(this.editor.state, this.editor.view.dispatch),
    };
  },
  addProseMirrorPlugins() {
    return [protocolStepPlacement(() => protocolHandlers(this.editor)?.stepsAllowed() ?? true)];
  },
});

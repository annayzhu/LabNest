import { Node, type NodeViewRenderer } from '@tiptap/core';
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * 执行记录 by day in the editor (Q427): each day is a fixed divider that shows the day's run (its steps, read only) and is followed by
 * what is written that day. Writing moves between days like any line — by dragging, the handle's arrows, or cut and paste — but the
 * days themselves come from the schedule: an edit may not remove, add or reorder them. The day with an empty key holds 未分天的记录.
 */
export function createDayBreakExtension(nodeView: NodeViewRenderer) {
  return Node.create({
    name: 'scientificDayBreak',
    group: 'block',
    atom: true,
    selectable: false,
    draggable: false,
    addAttributes() { return { dayKey: { default: '' } }; },
    parseHTML() { return [{ tag: 'div[data-day-break]', getAttrs: element => ({ dayKey: (element as HTMLElement).getAttribute('data-day-break') ?? '' }) }]; },
    renderHTML({ HTMLAttributes }) { return ['div', { 'data-day-break': HTMLAttributes.dayKey }]; },
    addNodeView() { return nodeView; },
    addProseMirrorPlugins() {
      const tell = (text: string) => this.editor.emit('notice', text);
      let current: EditorView | null = null;
      return [new Plugin({
        key: new PluginKey('keep-day-breaks'),
        view(view) { current = view; return { destroy() { current = null; } }; },
        filterTransaction(tr, state) {
          if (!tr.docChanged || tr.getMeta('preventUpdate') || dayKeys(tr.doc) === dayKeys(state.doc)) return true;
          // Cut has already copied the selection; only its delete is left to do, around the dividers.
          if (tr.getMeta('uiEvent') === 'cut' && current) { const view = current; queueMicrotask(() => { if (breaksIn(view.state)) view.dispatch(clearAroundBreaks(view.state)); }); }
          else tell('That would change the days, which come from the schedule, so it was not done.');
          return false;
        },
        props: {
          transformPasted: slice => new Slice(withoutBreaks(slice.content), slice.openStart, slice.openEnd),
          // A selection across days is cleared around the dividers before the key lands, as one across sections is.
          handleKeyDown(view, event) {
            if (event.isComposing || !breaksIn(view.state)) return false;
            const deleting = event.key === 'Backspace' || event.key === 'Delete';
            if (!deleting && event.key !== 'Enter' && (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey)) return false;
            view.dispatch(clearAroundBreaks(view.state));
            return deleting;
          },
        },
      })];
    },
  });
}

const dayKeys = (doc: ProseMirrorNode) => {
  const keys: string[] = [];
  doc.descendants(node => { if (node.type.name === 'scientificDayBreak') keys.push(String(node.attrs.dayKey)); return node.type.name !== 'scientificDayBreak'; });
  return keys.join('\n');
};

function withoutBreaks(fragment: Fragment): Fragment {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach(node => { if (node.type.name !== 'scientificDayBreak') nodes.push(node.isLeaf ? node : node.copy(withoutBreaks(node.content))); });
  return Fragment.from(nodes);
}

const isBreak = (node: ProseMirrorNode) => node.type.name === 'scientificDayBreak';

/** The selection holds a day divider and stays inside one section (one across sections is cleared section by section). */
function breaksIn({ selection: { from, to, empty, $from, $to }, doc }: EditorState) {
  if (empty || !$from.depth || !$to.depth || $from.index(0) !== $to.index(0)) return false;
  let found = false;
  doc.nodesBetween(from, to, node => { if (isBreak(node)) found = true; return !found; });
  return found;
}

/** Deletes `from`–`to` but leaves every day divider in it standing; follow with `fillEmptyDays`. */
export function deleteAroundBreaks(tr: Transaction, from: number, to: number) {
  const cuts: Array<[number, number]> = [];
  let start = from;
  tr.doc.nodesBetween(from, to, (node, at) => {
    if (!isBreak(node)) return true;
    if (at > start) cuts.push([start, at]);
    start = at + node.nodeSize;
    return false;
  });
  if (to > start) cuts.push([start, to]);
  // Last to first, so the positions still to come stay valid.
  for (const [cutFrom, cutTo] of cuts.reverse()) tr.deleteRange(cutFrom, cutTo);
  return tr;
}

/**
 * Gives every day without a line its line to write on, in the same step as the delete before it, so one undo brings back exactly
 * what was there. Call it once, after all the deleting: it inserts across the whole document.
 */
export function fillEmptyDays(tr: Transaction) {
  const bare: number[] = [];
  tr.doc.descendants((node, at, parent, index) => {
    if (!isBreak(node)) return true;
    const next = parent && index + 1 < parent.childCount ? parent.child(index + 1) : undefined;
    if (!next || isBreak(next)) bare.push(at + node.nodeSize);
    return false;
  });
  for (const at of bare.reverse()) tr.insert(at, tr.doc.type.schema.nodes.paragraph.create());
  return tr;
}

function clearAroundBreaks(state: EditorState) {
  const { from, to } = state.selection, tr = fillEmptyDays(deleteAroundBreaks(state.tr, from, to));
  return tr.setSelection(Selection.near(tr.doc.resolve(tr.mapping.map(from)), 1)).scrollIntoView();
}

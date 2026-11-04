import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const blocksWithoutCaret = new Set(['documentTool', 'documentPlate', 'documentMedia', 'scientificWidget', 'table']);
const containers = new Set(['doc', 'scientificSection']);

/** After saving a block the caret waits on the line below it, ready for the next "/". */
export function focusBelow(editor: Editor, isBlock: (node: ProseMirrorNode) => boolean) {
  let below: number | undefined;
  editor.state.doc.descendants((node, position) => {
    if (below === undefined && isBlock(node)) below = position + node.nodeSize + 1;
  });
  if (below !== undefined) editor.commands.focus(below);
}

/** Where a line is missing: after a block that takes no caret, unless ordinary text already follows it. */
export function missingLines(doc: ProseMirrorNode) {
  const positions: number[] = [];
  const walk = (parent: ProseMirrorNode, start: number) => {
    parent.forEach((child, offset, index) => {
      const at = start + offset;
      if (child.type.name === 'scientificSection') walk(child, at + 1);
      if (!blocksWithoutCaret.has(child.type.name)) return;
      const next = index + 1 < parent.childCount ? parent.child(index + 1) : undefined;
      if (!next || blocksWithoutCaret.has(next.type.name)) positions.push(at + child.nodeSize);
    });
  };
  if (containers.has(doc.type.name)) walk(doc, 0);
  return positions;
}

function moveBelowSelectedBlock(view: EditorView) {
  const { selection, doc, tr } = view.state;
  if (!(selection instanceof NodeSelection) || !blocksWithoutCaret.has(selection.node.type.name)) return false;
  view.dispatch(tr.setSelection(TextSelection.near(doc.resolve(selection.to), 1)));
  return true;
}

function addLines(state: EditorState) {
  const positions = missingLines(state.doc);
  if (!positions.length) return null;
  const tr = state.tr;
  for (const position of positions.reverse()) tr.insert(position, state.schema.nodes.paragraph.create());
  // These lines are a place to type, not an edit: an empty line saves nothing, and undo should not walk through it.
  return tr.setMeta('preventUpdate', true).setMeta('addToHistory', false);
}

/** Keeps a line to type on after tables, plates, files and tool outputs, so "/" can always add another one. Typing with one of them selected goes to the line below it: deleting a block stays a deliberate act. */
export const KeepLineAfterBlocks = Extension.create({
  name: 'keepLineAfterBlocks',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('keepLineAfterBlocks'),
      appendTransaction: (transactions, _before, state) => transactions.some((transaction) => transaction.docChanged) ? addLines(state) : null,
      props: {
        // Moved before the key lands, so what follows is ordinary typing: "/" opens its menu and an input method composes.
        handleKeyDown(view, event) {
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) moveBelowSelectedBlock(view);
          return false;
        },
        handleDOMEvents: { compositionstart: (view) => { moveBelowSelectedBlock(view); return false; } },
        // On-screen keyboards can skip the key event; this keeps the block from being replaced there too.
        handleTextInput(view, _from, _to, text) {
          if (!moveBelowSelectedBlock(view)) return false;
          view.dispatch(view.state.tr.insertText(text));
          return true;
        },
      },
      view: (view) => {
        // Saved content arrives without a transaction.
        queueMicrotask(() => {
          if (view.isDestroyed) return;
          const tr = addLines(view.state);
          if (tr) view.dispatch(tr);
        });
        return {};
      },
    })];
  },
});

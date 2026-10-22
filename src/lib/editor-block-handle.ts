import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { blockUnitAt, moveBlock, type BlockUnit } from './editor-blocks';

/** The block under the pointer, for its ＋ and ⋮⋮ handle. EditorSurface sets no `show` on a touch screen, which has no handle. */
export type BlockHover = { unit: BlockUnit; dom: HTMLElement };
type HandleStorage = { show: ((hover: BlockHover | null) => void) | null; link: (() => void) | null };

const report = (storage: HandleStorage, view: EditorView, pos: number | null) => {
  const unit = pos === null ? null : blockUnitAt(view.state.doc, pos);
  const dom = unit ? view.nodeDOM(unit.pos) : null;
  storage.show?.(unit && dom instanceof HTMLElement ? { unit, dom } : null);
};

/** Paste without formatting, one paragraph per line. */
async function pastePlainText(view: EditorView) {
  const { from, to } = view.state.selection, before = view.state.doc;
  const text = await navigator.clipboard.readText().catch(() => '');
  if (!text || !view.state.doc.eq(before)) return;
  const { schema } = view.state;
  const lines = text.split(/\r?\n/).map(line => schema.nodes.paragraph.create(null, line ? schema.text(line) : null));
  view.dispatch(view.state.tr.replaceWith(from, to, lines).scrollIntoView());
}

/**
 * Notion-style editing around the blocks: a handle beside the block under the pointer (hidden while typing),
 * ⌘⇧↑ / ⌘⇧↓ to move the block with the caret, ⌘⇧V to paste plain text and ⌘K for a link.
 */
export const BlockHandles = Extension.create<unknown, HandleStorage>({
  name: 'blockHandles',
  addStorage: () => ({ show: null, link: null }),
  addKeyboardShortcuts() {
    const move = (direction: -1 | 1) => () => {
      const { state, view } = this.editor;
      const unit = blockUnitAt(state.doc, state.selection.from);
      const tr = unit && moveBlock(state, unit, direction);
      if (tr) view.dispatch(tr);
      return Boolean(tr);
    };
    return {
      'Mod-Shift-ArrowUp': move(-1),
      'Mod-Shift-ArrowDown': move(1),
      'Mod-Shift-v': () => { void pastePlainText(this.editor.view); return true; },
      'Mod-k': () => { if (this.editor.state.selection.empty || !this.storage.link) return false; this.storage.link(); return true; },
    };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin({
      key: new PluginKey('blockHandles'),
      props: { handleDOMEvents: {
        mousemove(view, event) {
          if (!storage.show) return false;
          const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (found) report(storage, view, found.inside >= 0 ? found.inside : found.pos);
          return false;
        },
        keydown() { storage.show?.(null); return false; },
      } },
      view: () => ({ update(view, previous) { if (!previous.doc.eq(view.state.doc)) storage.show?.(null); } }),
    })];
  },
});

/** Drag a block by its handle: ProseMirror drops it where the drop cursor shows and removes it from where it was. */
export function startBlockDrag(view: EditorView, unit: BlockUnit, data: DataTransfer, image: HTMLElement) {
  const selection = NodeSelection.create(view.state.doc, unit.pos);
  view.dispatch(view.state.tr.setSelection(selection));
  view.dragging = { slice: selection.content(), move: true, node: selection } as unknown as typeof view.dragging;
  data.effectAllowed = 'copyMove';
  data.setData('text/plain', unit.node.textContent);
  data.setDragImage(image, 0, 0);
}
/** A drag that ended outside the editor must not linger into the next drop. */
export function endBlockDrag(view: EditorView) { view.dragging = null; }

/** Connect an editor's handles to the component that draws them. */
export function setBlockHandleHandlers(editor: { storage: unknown }, handlers: Partial<HandleStorage>) {
  const storage = (editor.storage as { blockHandles?: HandleStorage }).blockHandles;
  if (storage) Object.assign(storage, handlers);
}

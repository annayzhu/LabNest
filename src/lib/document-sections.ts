import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

declare module '@tiptap/core' {
  interface EditorEvents {
    /** Why an edit did not happen, for EditorSurface to show by the caret. */
    notice: string;
  }
}

/**
 * A document's sections are fixed: their titles and order come from its type and saving goes by section key, so an edit may
 * change what is in a section but never which sections there are. An edit over several sections clears each one in place;
 * anything else that would remove, merge or add a section does not happen and says why.
 */
export function keepSections(sectionName: string, tell: (text: string) => void) {
  let current: EditorView | null = null;
  const clearFirst = (view: EditorView) => {
    if (!spansSections(view.state)) return false;
    view.dispatch(clearSelectionInSections(view.state));
    return true;
  };
  return new Plugin({
    key: new PluginKey(`keep-${sectionName}`),
    view(view) { current = view; return { destroy() { current = null; } }; },
    filterTransaction(tr, state) {
      // Saved content arriving, which may show other sections, is not an edit.
      if (!tr.docChanged || tr.getMeta('preventUpdate') || sectionKeys(tr.doc) === sectionKeys(state.doc)) return true;
      // Cut has already copied the selection; only its delete is left to do.
      if (tr.getMeta('uiEvent') === 'cut' && current) { const view = current; queueMicrotask(() => clearFirst(view)); }
      else tell('That would change the document’s fixed sections, so it was not done.');
      return false;
    },
    props: {
      transformPasted: slice => withoutSections(slice, sectionName),
      handleKeyDown(view, event) {
        if (event.isComposing) return false;
        const deleting = event.key === 'Backspace' || event.key === 'Delete';
        if (spansSections(view.state)) {
          // Cleared before the key lands, so what follows is ordinary typing: "/" opens its menu and an input method composes.
          if (deleting || event.key === 'Enter' || (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) clearFirst(view);
          return deleting;
        }
        return deleting && !event.metaKey && !event.ctrlKey && !event.altKey && atSectionEdge(view, event, tell);
      },
      handleTextInput(view, _from, _to, text) {
        // On-screen keyboards can skip the key event.
        if (!clearFirst(view)) return false;
        view.dispatch(view.state.tr.insertText(text));
        return true;
      },
      handlePaste(view) { clearFirst(view); return false; },
      handleDOMEvents: { compositionstart(view) { clearFirst(view); return false; } },
    },
  });
}

const sectionKeys = (doc: ProseMirrorNode) => {
  const keys: string[] = [];
  doc.forEach(section => keys.push(String(section.attrs.sectionKey)));
  return keys.join('\n');
};

/** The document holds only sections, as records and Protocols do; an Entry holds lines. */
export const onlySections = ({ schema }: EditorState) => !schema.topNodeType.contentMatch.matchType(schema.nodes.paragraph);

/** The selection reaches past one section: select all, a drag from one section into the next, or a whole section. */
export function spansSections({ selection }: EditorState) {
  if (selection.empty) return false;
  const { $from, $to } = selection;
  return !$from.depth || !$to.depth || $from.index(0) !== $to.index(0);
}

/** Clears what is selected, one section at a time: the titles stay and each section keeps a line to write on. */
export function clearSelectionInSections(state: EditorState): Transaction {
  const { from, to } = state.selection, tr = state.tr, sections: Array<{ at: number; size: number }> = [];
  state.doc.forEach((section, at) => sections.push({ at, size: section.content.size }));
  // Last to first, so the positions still to come stay valid.
  for (const { at, size } of sections.reverse()) {
    const start = Math.max(from, at + 1), end = Math.min(to, at + 1 + size);
    if (start >= end) continue;
    tr.deleteRange(start, end);
    if (!tr.doc.nodeAt(at)!.childCount) tr.insert(at + 1, state.schema.nodes.paragraph.create());
  }
  return tr.setSelection(Selection.near(tr.doc.resolve(tr.mapping.map(from)), 1)).scrollIntoView();
}

/** Copied or dragged content keeps its lines but not the sections around them: a section is the document's structure, never content. */
export function withoutSections(slice: Slice, sectionName: string) {
  if (slice.content.firstChild?.type.name !== sectionName) return slice;
  const lines: ProseMirrorNode[] = [];
  slice.content.forEach(section => section.content.forEach(line => { lines.push(line); }));
  return lines.length ? new Slice(Fragment.fromArray(lines), Math.max(0, slice.openStart - 1), Math.max(0, slice.openEnd - 1)) : Slice.empty;
}

/** Backspace at the very top of a section or Delete at its very end, where the key would otherwise reach a fixed title. True when it is dealt with here. */
function atSectionEdge(view: EditorView, event: KeyboardEvent, tell: (text: string) => void) {
  const { selection: { empty, $from }, doc, tr, schema } = view.state, back = event.key === 'Backspace';
  if (!empty || $from.depth < 2 || !$from.parent.isTextblock) return false;
  const levels = $from.depth - 1;
  if ($from.pos !== (back ? $from.start(1) + levels : $from.end(1) - levels)) return false;
  const holder = levels > 1 ? $from.node(2).type.name : null;
  // A list or quote at the top lifts out of itself and stays in the section. A Protocol's first step stays a step.
  if (back && holder && holder !== 'protocolStep' && holder !== 'table') return false;
  const section = $from.node(1), blank = !$from.parent.content.size;
  if (!holder && blank && section.childCount > 1) {
    const at = $from.before(2);
    tr.delete(at, $from.after(2));
    view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(back ? at : at - 1), back ? 1 : -1)).scrollIntoView());
    return true;
  }
  // An empty heading or quote line turns back into body text.
  if (!holder && blank && $from.parent.type !== schema.nodes.paragraph) return false;
  // Holding the key down to erase a line is not an attempt to delete the title.
  if (!event.repeat) {
    if (back) tell('Section titles are part of the document’s fixed structure and can’t be deleted.');
    else if ($from.index(0) < doc.childCount - 1) tell('This is the end of the section. The next section’s title is fixed, so the two can’t be merged.');
  }
  return true;
}

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/** "/" — or "、" and "／" from a Chinese keyboard. */
const slash = /^[/、／]/;

/** Typing `text` at `from` opens a command menu: a slash at the start of a line or after a space or Chinese punctuation, never inside a word or while an IME composes. */
export function slashOpensMenu(view: EditorView, from: number, text: string) {
  if (!slash.test(text) || view.composing) return false;
  const $from = view.state.doc.resolve(from);
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, '￼');
  return $from.parent.isTextblock && (!before || /[\s，。；：、（(]/.test(before));
}

/** What was typed after the slash at `from`; null once the menu should close (the slash is gone, a space or line break was typed, text is selected, or the query grew long). */
export function slashQuery(state: EditorState, from: number) {
  const cursor = state.selection.from;
  const text = cursor > from ? state.doc.textBetween(from, cursor, '\n', '￼') : '';
  if (!slash.test(text) || /[\s￼]/.test(text) || text.length > 24 || !state.selection.empty) return null;
  return text.slice(1);
}

/** Where a menu opens, in viewport coordinates: the caret, or the button that opened it. */
export type MenuAnchor = { top: number; left: number; bottom: number };
type SlashHandlers = { open: (from: number, anchor: MenuAnchor) => void; onKey: (event: KeyboardEvent) => boolean };
type SlashStorage = { handlers: SlashHandlers | null };

/** "/" opens a command menu at the caret; while it is open, `onKey` sees ↑ ↓ Enter and Esc before any other keymap. The handlers are read at event time. */
export const SlashCommandTrigger = Extension.create<unknown, SlashStorage>({
  name: 'slashCommandTrigger',
  priority: 1000,
  addStorage: () => ({ handlers: null }),
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin({ key: new PluginKey('slashCommandTrigger'), props: {
      handleTextInput(view, from, _to, text) {
        if (slashOpensMenu(view, from, text)) queueMicrotask(() => { const { top, left, bottom } = view.coordsAtPos(from); storage.handlers?.open(from, { top, left, bottom }); });
        return false;
      },
      handleKeyDown: (_view, event) => storage.handlers?.onKey(event) ?? false,
    } })];
  },
});

/** Connect an editor's "/" to the component showing its menu. */
export function setSlashHandlers(editor: { storage: unknown }, handlers: SlashHandlers) {
  const storage = (editor.storage as { slashCommandTrigger?: SlashStorage }).slashCommandTrigger;
  if (storage) storage.handlers = handlers;
}

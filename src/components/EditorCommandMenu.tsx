'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { LucideIcon } from 'lucide-react';
import { setSlashHandlers, slashQuery, type MenuAnchor } from '@/lib/editor-slash';
import { translateUiText } from '@/lib/i18n';
import { useAnchoredPosition, useDismiss } from './protocol/popover';
import './editor-command-menu.css';

/** One choice in a "/" or "＋" menu. `keywords` hold pinyin initials and English, so "bg" or "table" finds Table (表格). */
export type EditorCommand<C> = { id: string; group: string; label: string; hint: string; keywords: string; icon: LucideIcon; choice: C };
/** Opened by "/" while writing (the query is what follows it in the text) or by a button (the menu has its own search field). */
export type EditorCommandMenuState = { mode: 'slash'; from: number; query: string; anchor: MenuAnchor } | { mode: 'button'; query: ''; anchor: MenuAnchor };
export type CommandKeyHandler = React.RefObject<((event: KeyboardEvent) => boolean) | null>;

// The label and hint match in English and in Chinese, so "volume" and 体积 both find Volume in either interface.
const matches = (command: EditorCommand<unknown>, query: string) => !query || command.keywords.includes(query)
  || [command.label, command.hint].some(text => text.toLowerCase().includes(query) || translateUiText(text, 'zh').includes(query));

/** Keeps a "/" menu's query in step with the text typed after the slash and closes it when that text ends. An IME's interim pinyin never closes it. */
export function useSlashQuery(editor: Editor | null, menu: EditorCommandMenuState | null, setMenu: (menu: EditorCommandMenuState | null) => void) {
  useEffect(() => {
    if (!editor || menu?.mode !== 'slash') return;
    const track = () => {
      const query = slashQuery(editor.state, menu.from);
      if (query === null) { if (!editor.view.composing) setMenu(null); }
      else if (query !== menu.query) setMenu({ ...menu, query });
    };
    editor.on('transaction', track);
    return () => { editor.off('transaction', track); };
  }, [editor, menu, setMenu]);
}

/** A writing editor's "/" menu: typing "/" opens it at the caret, ＋ opens it with a search field; it closes when its text ends. */
export function useCommandMenu(editor: Editor | null) {
  const [menu, setMenu] = useState<EditorCommandMenuState | null>(null);
  // Set only while the menu is mounted, so the editor's keys reach it only while it is open.
  const keyRef: CommandKeyHandler = useRef(null);
  useEffect(() => {
    if (editor) setSlashHandlers(editor, { open: (from, anchor) => setMenu({ mode: 'slash', from, query: '', anchor }), onKey: event => keyRef.current?.(event) ?? false });
  }, [editor]);
  useSlashQuery(editor, menu, setMenu);
  const openSearch = useCallback((anchor: MenuAnchor) => setMenu({ mode: 'button', query: '', anchor }), []);
  // Back to the page, at the caret the menu was opened for.
  const close = useCallback(() => { setMenu(null); editor?.view.focus(); }, [editor]);
  return { menu, keyRef, openSearch, close };
}

/** The grouped command list behind every editor's "/" and ＋: ↑ ↓ to move, Enter to choose, Esc or a click outside to close. */
export function EditorCommandMenu<C>({ state, commands, label, searchPlaceholder, emptyText, onChoose, onClose, keyRef }: {
  state: EditorCommandMenuState; commands: EditorCommand<C>[]; label: string; searchPlaceholder: string; emptyText: string;
  onChoose: (choice: C) => void; onClose: () => void; keyRef: CommandKeyHandler;
}) {
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState('');
  const query = (state.mode === 'slash' ? state.query : filter).trim().toLowerCase();
  const visible = useMemo(() => commands.filter(command => matches(command, query)), [commands, query]);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const style = useAnchoredPosition(state.anchor, panel, [visible.length]);
  useDismiss(panel, null, onClose);
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) { setSeenQuery(query); setActive(0); }
  // Text after "/" that matches nothing for three characters (a path, a ratio) is writing, not a command.
  const [matchedLength, setMatchedLength] = useState(0);
  if (visible.length && matchedLength !== query.length) setMatchedLength(query.length);
  const writing = state.mode === 'slash' && !visible.length && query.length - matchedLength >= 3;
  useEffect(() => { if (writing) onClose(); }, [writing, onClose]);
  useEffect(() => {
    keyRef.current = event => {
      // With nothing to choose, the arrows and Enter stay the writer's.
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && visible.length) { event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length); return true; }
      if (event.key === 'Enter' && visible[active]) { event.preventDefault(); onChoose(visible[active].choice); return true; }
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return true; }
      return false;
    };
    return () => { keyRef.current = null; };
  }, [keyRef, visible, active, onChoose, onClose]);
  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  // The panel is hidden until placed, and a hidden field cannot take focus; the search field takes it once the panel shows.
  const search = useRef<HTMLInputElement>(null);
  const shown = style.visibility === 'visible';
  useEffect(() => { if (shown) search.current?.focus(); }, [shown]);
  return createPortal(<div ref={panel} className="ln-insert-menu" style={style} role="dialog" aria-label={label}>
    {state.mode === 'button' ? <input ref={search} className="ln-insert-filter" placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={filter} onChange={event => setFilter(event.target.value)}
      onKeyDown={event => { if (keyRef.current?.(event.nativeEvent)) event.stopPropagation(); }} /> : null}
    <div ref={list} className="ln-insert-list" role="listbox" aria-label={label}>
      {visible.map((command, index) => { const header = index === 0 || visible[index - 1].group !== command.group ? command.group : null; const Icon = command.icon; return <div key={command.id}>
        {header ? <p className="ln-insert-group">{header}</p> : null}
        <button className="focus-ring" type="button" role="option" aria-selected={index === active} data-index={index} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => onChoose(command.choice)}>
          <span className="ln-insert-icon"><Icon aria-hidden /></span><span><strong>{command.label}</strong><small>{command.hint}</small></span>
        </button></div>; })}
      {!visible.length ? <p className="ln-insert-empty">{emptyText}</p> : null}
    </div>
    {state.mode === 'slash' && visible.length ? <p className="ln-insert-keys" aria-hidden><span><kbd>↑</kbd><kbd>↓</kbd>Select</span><span><kbd>↵</kbd>Insert</span><span><kbd>Esc</kbd>Close</span></p> : null}
  </div>, document.body);
}

'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Code, Copy, GripVertical, Heading2, Heading3, ImagePlus, IndentDecrease, IndentIncrease, Italic, KeyboardOff, Link2, List, ListChecks, ListOrdered, Pilcrow, Plus, Quote, Redo2, RemoveFormatting, Strikethrough, Subscript, Superscript, Trash2, Type, Underline, Undo2, Unlink, type LucideIcon } from 'lucide-react';
import { setSelectionFontSize } from '@/lib/document-text-formatting';
import { RICH_TEXT_FONT_SIZES_PT } from '@/lib/rich-text-font-size';
import { RICH_TEXT_LINE_HEIGHTS } from '@/lib/rich-text-line-height';
import { RICH_TEXT_RISK_COLOR_HEX } from '@/lib/rich-text-color';
import { endBlockDrag, setBlockHandleHandlers, startBlockDrag, type BlockHover } from '@/lib/editor-block-handle';
import { blockKind, blockTakesFormat, blockTakesKinds, blockUnitAt, canDuplicateBlock, currentBlockUnit, deleteBlock, duplicateBlock, lineUnitAt, moveBlock, moveBlockTo, selectBlock, turnInto, type BlockKind, type BlockUnit } from '@/lib/editor-blocks';
import type { MenuAnchor } from '@/lib/editor-slash';
import { postNative } from '@/lib/native-bridge';
import { useAnchoredPosition, useDismiss } from './protocol/popover';
import { useEditorPortalPending } from './useEditorPortalPending';
import './editor-surface.css';

export type BlockMenuItem = { id: string; label: string; icon: LucideIcon; run: (unit: BlockUnit, anchor: MenuAnchor) => void };
type TableBarItem = { id: string; label: string; run: () => void };
type EditorSurfaceProps = {
  editor: Editor;
  /** ＋ and ⋮⋮ beside the blocks; an editor inside a widget has only the bubble. */
  handles?: boolean;
  /** The kinds Turn into offers in this editor (a Protocol has no checklist). */
  kinds?: BlockKind[];
  /** ＋ opens this editor's "/" menu with its own search field. */
  openCommands: (anchor: MenuAnchor) => void;
  /** The picture button over a phone's keyboard; an editor whose document keeps no pictures has none. */
  insertImage?: () => void;
  /** Items only this editor has, e.g. a Protocol block's 适用范围. */
  blockItems?: (unit: BlockUnit) => BlockMenuItem[];
  tableItems?: () => TableBarItem[];
  /** After ⋮⋮ deleted a block, e.g. to drop a Protocol block's 适用范围 rules. */
  afterDelete?: (unit: BlockUnit) => void;
  children: ReactNode;
};

const kindChoices: Array<{ kind: BlockKind; label: string; icon: LucideIcon }> = [
  { kind: 'paragraph', label: 'Body', icon: Pilcrow }, { kind: 'heading', label: 'Heading', icon: Heading2 }, { kind: 'subheading', label: 'Subheading', icon: Heading3 }, { kind: 'quote', label: 'Quote', icon: Quote },
  { kind: 'bullet', label: 'Bullet points', icon: List }, { kind: 'ordered', label: 'Numbered list', icon: ListOrdered }, { kind: 'task', label: 'To-do list', icon: ListChecks },
];
const allKinds = kindChoices.map(choice => choice.kind);

/** The first line of a block, to set its handle beside it. */
function firstLine(view: EditorView, unit: BlockUnit) {
  let textPos = unit.node.isTextblock ? unit.pos + 1 : null;
  if (textPos === null) unit.node.descendants((node, pos) => { if (textPos !== null) return false; if (node.isTextblock) { textPos = unit.pos + 2 + pos; return false; } return true; });
  if (textPos === null) return null;
  try { const { top, bottom } = view.coordsAtPos(textPos); return { top, bottom }; } catch { return null; }
}

const touchQuery = '(pointer: coarse)';
function useTouchScreen() {
  return useSyncExternalStore(
    onChange => { const query = window.matchMedia(touchQuery); query.addEventListener('change', onChange); return () => query.removeEventListener('change', onChange); },
    () => window.matchMedia(touchQuery).matches,
    () => false,
  );
}

/**
 * The page an editor is written on, Notion-style. With a mouse: ＋ and ⋮⋮ beside the block under the pointer and a bubble over
 * selected text. On a touch screen: a bar over the keyboard and a long press on a block. Either way a bar over the table
 * with the caret. There is no toolbar at the top: everything else is "/" or a shortcut.
 */
export function EditorSurface({ editor, handles = true, kinds = allKinds, openCommands, insertImage, blockItems, tableItems, afterDelete, children }: EditorSurfaceProps) {
  const touch = useTouchScreen();
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<BlockHover | null>(null);
  const [menu, setMenu] = useState<{ unit: BlockUnit; anchor: HTMLElement } | null>(null);
  const [linking, setLinking] = useState(false);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While a block's menu is open, its handle stays with it.
  const menuOpen = useRef(false);
  useEffect(() => { menuOpen.current = Boolean(menu); }, [menu]);
  useEffect(() => {
    setBlockHandleHandlers(editor, { show: handles && !touch ? next => { if (menuOpen.current) return; if (leave.current) clearTimeout(leave.current); setHover(next); } : null, link: () => setLinking(true) });
    return () => setBlockHandleHandlers(editor, { show: null, link: null });
  }, [editor, handles, touch]);
  useLongPressBlocks(editor, touch && handles, (unit, anchor) => setMenu({ unit, anchor }));
  useEffect(() => () => { if (leave.current) clearTimeout(leave.current); }, []);
  const stay = () => { if (leave.current) clearTimeout(leave.current); };
  // Crossing the margin to the handle must not hide it.
  const later = () => { stay(); leave.current = setTimeout(() => { if (!menuOpen.current) setHover(null); }, 320); };
  return <div ref={setSurface} className="ln-editor-surface" onMouseLeave={later} onMouseEnter={stay}>
    {children}
    {hover && surface && !touch ? <BlockHandle key={hover.unit.pos} editor={editor} hover={hover} surface={surface} menuOpen={Boolean(menu)} onMenu={anchor => setMenu(current => current ? null : { unit: hover.unit, anchor })} openCommands={openCommands} onEnter={stay} /> : null}
    {menu ? <BlockMenu editor={editor} unit={menu.unit} anchor={menu.anchor} kinds={kinds} blockItems={blockItems} afterDelete={afterDelete} openCommands={openCommands} onClose={() => { setMenu(null); setHover(null); }} /> : null}
    {touch ? <KeyboardBar editor={editor} blocks={handles} kinds={kinds} openCommands={openCommands} insertImage={insertImage} linking={linking} setLinking={setLinking}
      onBlockMenu={anchor => { const unit = blockUnitAt(editor.state.doc, editor.state.selection.from); if (unit) setMenu({ unit, anchor }); }} />
      : <SelectionBubble editor={editor} linking={linking} setLinking={setLinking} kinds={kinds} />}
    <TableBar editor={editor} items={tableItems} />
  </div>;
}

/** ＋: write on an empty line where it is, or start a new line below (⌥: above), and open "/" there. */
function addLine(editor: Editor, opened: BlockUnit, above: boolean, openCommands: EditorSurfaceProps['openCommands']) {
  const unit = currentBlockUnit(editor.state.doc, opened);
  if (!unit) return;
  const { view } = editor;
  let at = unit.pos + 1;
  if (!(unit.node.type.name === 'paragraph' && !unit.node.content.size)) {
    const pos = above ? unit.pos : unit.pos + unit.node.nodeSize;
    view.dispatch(view.state.tr.insert(pos, view.state.schema.nodes.paragraph.create()));
    at = pos + 1;
  }
  // The caret waits on the new line while the menu's search field has the focus; choosing or closing returns it to the page.
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
  const { top, left, bottom } = view.coordsAtPos(at);
  openCommands({ top, left, bottom });
}

function BlockHandle({ editor, hover, surface, menuOpen, onMenu, openCommands, onEnter }: { editor: Editor; hover: BlockHover; surface: HTMLElement; menuOpen: boolean; onMenu: (anchor: HTMLElement) => void; openCommands: EditorSurfaceProps['openCommands']; onEnter: () => void }) {
  const [place, setPlace] = useState<{ top: number; left: number; scale: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      if (!hover.dom.isConnected) return setPlace(null);
      const frame = surface.getBoundingClientRect(), block = hover.dom.getBoundingClientRect();
      // The page may be zoomed; positions inside it are in its own units.
      const scale = frame.width / (surface.offsetWidth || frame.width) || 1;
      const line = firstLine(editor.view, hover.unit) ?? { top: block.top, bottom: Math.min(block.bottom, block.top + 28) };
      setPlace({ top: ((line.top + line.bottom) / 2 - frame.top) / scale, left: (block.left - frame.left) / scale, scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [editor, hover, surface]);
  // A narrow screen has little margin: the handle stays on screen, overlapping the first letters only if it must.
  useLayoutEffect(() => {
    const rect = box.current?.getBoundingClientRect();
    // Print styles hide the handle. Its zero rectangle cannot be moved on screen;
    // trying to correct it on every layout would cause an infinite render loop.
    if (place && rect && rect.width > 0 && rect.left < 2) setPlace({ ...place, left: place.left + (2 - rect.left) / place.scale });
  }, [place]);
  if (!place) return null;
  const dragStart = (event: React.DragEvent<HTMLButtonElement>) => { const unit = currentBlockUnit(editor.state.doc, hover.unit); if (unit) startBlockDrag(editor.view, unit, event.dataTransfer, hover.dom); };
  return <div ref={box} className="ln-block-handle" style={{ top: place.top, left: place.left }} data-open={menuOpen || undefined} contentEditable={false} data-print-hidden onMouseEnter={onEnter}>
    <button type="button" className="focus-ring" aria-label="Insert below (hold ⌥ for above)" title="Insert below · ⌥ above" onMouseDown={event => event.preventDefault()} onClick={event => addLine(editor, hover.unit, event.altKey, openCommands)}><Plus aria-hidden /></button>
    <button type="button" className="focus-ring" draggable aria-label="Drag to move, click for the menu" title="Drag to move · click for the menu" aria-haspopup="menu" aria-expanded={menuOpen}
      onDragStart={dragStart} onDragEnd={() => endBlockDrag(editor.view)} onClick={event => onMenu(event.currentTarget)}><GripVertical aria-hidden /></button>
  </div>;
}

function BlockMenu({ editor, unit: opened, anchor, kinds, blockItems, afterDelete, openCommands, onClose }: { editor: Editor; unit: BlockUnit; anchor: HTMLElement; kinds: BlockKind[]; blockItems?: EditorSurfaceProps['blockItems']; afterDelete?: EditorSurfaceProps['afterDelete']; openCommands: EditorSurfaceProps['openCommands']; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const pending = useEditorPortalPending(editor, panel);
  const style = useAnchoredPosition(anchor, panel);
  useDismiss(panel, anchor, onClose);
  const unit = currentBlockUnit(editor.state.doc, opened);
  if (!unit) return null;
  const run = (action: () => void) => { action(); onClose(); };
  const dispatch = (tr: Transaction | null) => { if (tr) editor.view.dispatch(tr); editor.view.focus(); };
  const current = blockKind(unit.node);
  const attrs = unit.node.firstChild?.isTextblock ? unit.node.firstChild.attrs : unit.node.attrs;
  const media = unit.node.type.name === 'documentMedia';
  const choices = blockTakesKinds(unit.node) ? kindChoices.filter(choice => kinds.includes(choice.kind)) : [];
  const items = blockItems?.(unit) ?? [];
  return createPortal(<div ref={panel} inert={pending} className="ln-block-menu" style={style} role="menu" aria-label="Block actions">
    {choices.length ? <section aria-label="Turn into"><p>Turn into</p><div className="ln-block-menu-kinds">
      {choices.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" role="menuitemradio" aria-checked={current === kind} onClick={() => run(() => turnInto(editor, selectBlock(editor, unit), kind).run())}><Icon aria-hidden /><span>{label}</span></button>)}
    </div></section> : null}
    {blockTakesFormat(unit.node) ? <section aria-label="Format"><p>Format</p>
      <div className="ln-block-menu-row" role="group" aria-label="Text alignment">
        {([['left', AlignLeft, 'Align left'], ['center', AlignCenter, 'Align center'], ['right', AlignRight, 'Align right'], ['justify', AlignJustify, 'Justify']] as const).map(([align, Icon, label]) =>
          <button key={align} type="button" role="menuitemradio" aria-checked={(attrs.textAlign ?? 'left') === align} aria-label={label} title={label} onClick={() => run(() => selectBlock(editor, unit).setTextAlign(align).run())}><Icon aria-hidden /></button>)}
        <span className="ln-block-menu-gap" />
        <button type="button" role="menuitem" aria-label="Decrease indent" title="Decrease indent" disabled={unit.node.type.name !== 'paragraph'} onClick={() => run(() => selectBlock(editor, unit).indentDocumentParagraph(-1).run())}><IndentDecrease aria-hidden /></button>
        <button type="button" role="menuitem" aria-label="Increase indent" title="Increase indent" disabled={unit.node.type.name !== 'paragraph'} onClick={() => run(() => selectBlock(editor, unit).indentDocumentParagraph(1).run())}><IndentIncrease aria-hidden /></button>
      </div>
      <label className="ln-block-menu-field"><span>Font size</span><select defaultValue="" onChange={event => { const value = event.target.value; run(() => { selectBlock(editor, unit).run(); setSelectionFontSize(editor, value === 'default' ? null : Number(value)); }); }}>
        <option value="" disabled>Choose…</option><option value="default">Default</option>{RICH_TEXT_FONT_SIZES_PT.map(size => <option key={size} value={size}>{size} pt</option>)}
      </select></label>
      <label className="ln-block-menu-field"><span>Line spacing</span><select defaultValue={String(attrs.documentLineHeight ?? '')} onChange={event => { const value = event.target.value; run(() => selectBlock(editor, unit).setDocumentBlockLineHeight(value).run()); }}>
        <option value="" disabled>Default</option>{RICH_TEXT_LINE_HEIGHTS.map(height => <option key={height} value={String(height)}>{height}×</option>)}
      </select></label>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => selectBlock(editor, unit).unsetAllMarks().resetAttributes('paragraph', ['textAlign', 'documentIndent', 'spaceBeforePt', 'spaceAfterPt', 'documentLineHeight']).resetAttributes('heading', ['textAlign', 'documentLineHeight']).run())}><RemoveFormatting aria-hidden />Clear formatting</button>
    </section> : null}
    {items.length ? <section aria-label="This block">{items.map(({ id, label, icon: Icon, run: action }) => <button key={id} type="button" role="menuitem" className="ln-block-menu-item" onClick={() => { const { top, left, bottom } = anchor.getBoundingClientRect(); run(() => action(unit, { top, left, bottom })); }}><Icon aria-hidden />{label}</button>)}</section> : null}
    <section aria-label="Block">
      {/* Touch screens have no ＋ beside the block: it is here instead. */}
      <button type="button" role="menuitem" className="ln-block-menu-item is-touch" onClick={() => run(() => addLine(editor, unit, false, openCommands))}><Plus aria-hidden />Insert below…</button>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => dispatch(moveBlock(editor.state, unit, -1)))}><ArrowUp aria-hidden />Move up<kbd>⌘⇧↑</kbd></button>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => dispatch(moveBlock(editor.state, unit, 1)))}><ArrowDown aria-hidden />Move down<kbd>⌘⇧↓</kbd></button>
      <button type="button" role="menuitem" className="ln-block-menu-item" disabled={!canDuplicateBlock(unit)} onClick={() => run(() => dispatch(duplicateBlock(editor.state, unit)))}><Copy aria-hidden />Duplicate</button>
      <button type="button" role="menuitem" className="ln-block-menu-item is-danger" onClick={() => run(() => { dispatch(deleteBlock(editor.state, unit)); afterDelete?.(unit); })}><Trash2 aria-hidden />{media ? 'Remove (keeps the file)' : 'Delete'}</button>
    </section>
  </div>, document.body);
}

// Bubble settings never change: new objects on every render would re-send them to the editor each time.
const onPage = () => document.body;
const overText = { strategy: 'fixed', placement: 'top', offset: 8, flip: true, shift: { padding: 8 } } as const;
const overTable = { strategy: 'fixed', placement: 'top-start', offset: 6, flip: false, shift: { padding: 8 } } as const;
const textSelected: BubbleMenuProps['shouldShow'] = ({ editor, state, from, to }) => editor.isEditable && from !== to && !(state.selection instanceof NodeSelection) && !editor.isActive('codeBlock');
// The caret in a table; selected text there gets the text bubble instead.
const caretInTable: BubbleMenuProps['shouldShow'] = ({ editor, from, to }) => editor.isEditable && from === to && editor.isActive('table');

/** Over selected text with a mouse: the formatting controls in a bubble. */
function SelectionBubble({ editor, linking, setLinking, kinds }: { editor: Editor; linking: boolean; setLinking: (value: boolean) => void; kinds: BlockKind[] }) {
  const panel = useRef<HTMLDivElement>(null);
  const pending = useEditorPortalPending(editor, panel);
  return <BubbleMenu editor={editor} pluginKey="selectionBubble" appendTo={onPage} style={{ zIndex: 60 }} options={overText} shouldShow={textSelected}>
    <div ref={panel} inert={pending} className="ln-selection-bubble" role="toolbar" aria-label="Text formatting" data-print-hidden onMouseDown={event => { if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) event.preventDefault(); }}>
      <FormattingControls editor={editor} linking={linking} setLinking={setLinking} kinds={kinds} />
    </div>
  </BubbleMenu>;
}

/**
 * For selected text, Notion-style: the block's kind, the font size, the marks, superscript and subscript, code, a link,
 * the risk colour, and clearing all of it. Only what this editor's document can keep is offered. In the bubble with a mouse,
 * in the bar over the keyboard on a touch screen.
 */
function FormattingControls({ editor, linking, setLinking, kinds }: { editor: Editor; linking: boolean; setLinking: (value: boolean) => void; kinds: BlockKind[] }) {
  const scripts = Boolean(editor.schema.marks.superscript && editor.schema.marks.subscript);
  const state = useEditorState({ editor, selector: ({ editor: current }) => {
    const unit = lineUnitAt(current.state.doc, current.state.selection.from);
    return {
      bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), strike: current.isActive('strike'), code: current.isActive('code'),
      superscript: scripts && current.isActive('superscript'), subscript: scripts && current.isActive('subscript'),
      link: current.getAttributes('link').href as string | undefined, risk: current.getAttributes('textStyle').color === RICH_TEXT_RISK_COLOR_HEX,
      fontSize: Number.parseInt(String(current.getAttributes('textStyle').fontSize ?? ''), 10) || null,
      kind: unit && blockTakesKinds(unit.node) ? blockKind(unit.node) : null,
    };
  } });
  const [href, setHref] = useState('');
  const chain = () => editor.chain().focus(undefined, { scrollIntoView: false });
  const marks: Array<[keyof typeof state, LucideIcon, string, () => void]> = [
    ['bold', Bold, 'Bold ⌘B', () => chain().toggleBold().run()], ['italic', Italic, 'Italic ⌘I', () => chain().toggleItalic().run()],
    ['underline', Underline, 'Underline ⌘U', () => chain().toggleUnderline().run()], ['strike', Strikethrough, 'Strikethrough ⌘⇧S', () => chain().toggleStrike().run()],
  ];
  // CO₂ and 10⁶: one of the two at a time.
  const toggleScript = (mark: 'superscript' | 'subscript') => chain().unsetMark(mark === 'superscript' ? 'subscript' : 'superscript').toggleMark(mark).run();
  const clearFormatting = () => {
    const cleared = chain().unsetBold().unsetItalic().unsetUnderline().unsetStrike().unsetCode().unsetColor().unsetFontSize();
    (scripts ? cleared.unsetMark('superscript').unsetMark('subscript') : cleared).run();
  };
  // An empty address removes the link.
  const applyLink = (value: string) => { const range = chain().extendMarkRange('link'); (value ? range.setLink({ href: value }) : range.unsetLink()).run(); setLinking(false); };
  const choices = kindChoices.filter(choice => kinds.includes(choice.kind));
  /* No <form> here: the editor sits inside the page's form, and React would pass a submit up to it. */
  if (linking) return <div className="ln-selection-link">
    <input autoFocus value={href} onChange={event => setHref(event.target.value)} placeholder="Paste or type a link, then Enter" aria-label="Link address" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); applyLink(href.trim()); }
      else if (event.key === 'Escape') { event.preventDefault(); setLinking(false); editor.view.focus(); }
    }} />
    {state.link ? <button type="button" aria-label="Remove link" title="Remove link" onClick={() => applyLink('')}><Unlink aria-hidden /></button> : null}
  </div>;
  return <>
    {state.kind && choices.length ? <select className="ln-selection-select" aria-label="Turn into" title="Turn into" value={state.kind} onChange={event => { turnInto(editor, chain(), event.target.value as BlockKind).run(); }}>
      {choices.map(choice => <option key={choice.kind} value={choice.kind}>{choice.label}</option>)}
    </select> : null}
    <select className="ln-selection-select is-size" aria-label="Font size" title="Font size" value={state.fontSize ?? ''} onChange={event => { const value = event.target.value; setSelectionFontSize(editor, value ? Number(value) : null); editor.view.focus(); }}>
      <option value="">Font size</option>{RICH_TEXT_FONT_SIZES_PT.map(size => <option key={size} value={size}>{size} pt</option>)}
    </select>
    <span className="ln-selection-divider" aria-hidden />
    {marks.map(([key, Icon, label, toggle]) => <button key={key} type="button" aria-label={label} title={label} aria-pressed={Boolean(state[key])} onClick={toggle}><Icon aria-hidden /></button>)}
    {scripts ? <>
      <button type="button" aria-label="Superscript" title="Superscript (10⁶, m²)" aria-pressed={state.superscript} onClick={() => toggleScript('superscript')}><Superscript aria-hidden /></button>
      <button type="button" aria-label="Subscript" title="Subscript (CO₂, H₂O)" aria-pressed={state.subscript} onClick={() => toggleScript('subscript')}><Subscript aria-hidden /></button>
    </> : null}
    <button type="button" aria-label="Inline code" title="Inline code (sequences, commands)" aria-pressed={state.code} onClick={() => chain().toggleCode().run()}><Code aria-hidden /></button>
    <span className="ln-selection-divider" aria-hidden />
    <button type="button" aria-label="Link ⌘K" title="Link ⌘K" aria-pressed={Boolean(state.link)} onClick={() => { setHref(state.link ?? ''); setLinking(true); }}><Link2 aria-hidden /></button>
    <button type="button" className="ln-selection-risk" aria-label="Risk red" title={state.risk ? 'Restore default color' : 'Mark in risk red'} aria-pressed={state.risk} onClick={() => (state.risk ? chain().unsetColor() : chain().setColor(RICH_TEXT_RISK_COLOR_HEX)).run()}>A</button>
    <button type="button" aria-label="Clear formatting" title="Clear formatting (links kept)" onClick={clearFormatting}><RemoveFormatting aria-hidden /></button>
  </>;
}

/** How far the keyboard pushes up the bottom of what is visible: fixed elements stay with the window, not with the keyboard. */
function useKeyboardInset() {
  return useSyncExternalStore(
    onChange => { const view = window.visualViewport; view?.addEventListener('resize', onChange); view?.addEventListener('scroll', onChange); return () => { view?.removeEventListener('resize', onChange); view?.removeEventListener('scroll', onChange); }; },
    () => { const view = window.visualViewport; return view ? Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop)) : 0; },
    () => 0,
  );
}

/** A tap on the bar must leave the caret and the keyboard where they are; its own fields (a link, the font size) still take the focus. */
const keepFocus = (event: React.PointerEvent | React.MouseEvent) => { if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) event.preventDefault(); };

/**
 * On a touch screen, Notion-style: one row over the keyboard while the editor has the focus. With the caret it inserts
 * ("/"), opens the block's menu (turn into, format, move, delete), adds a picture, marks the line in risk red, indents, undoes and
 * hides the keyboard; with text selected it carries what the bubble carries with a mouse. An editor inside a widget (`blocks`
 * false) has only the marks, undo and the keyboard.
 */
function KeyboardBar({ editor, blocks, kinds, openCommands, insertImage, linking, setLinking, onBlockMenu }: {
  editor: Editor; blocks: boolean; kinds: BlockKind[]; openCommands: EditorSurfaceProps['openCommands']; insertImage?: () => void;
  linking: boolean; setLinking: (value: boolean) => void; onBlockMenu: (anchor: HTMLElement) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => editor.isFocused);
  const inset = useKeyboardInset();
  useEffect(() => {
    const show = () => setVisible(true);
    // Leaving for the bar's own field keeps it.
    const hide = () => setTimeout(() => { if (!editor.isFocused && !bar.current?.contains(document.activeElement)) { setVisible(false); setLinking(false); } }, 0);
    editor.on('focus', show);
    editor.on('blur', hide);
    return () => { editor.off('focus', show); editor.off('blur', hide); };
  }, [editor, setLinking]);
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    selected: !current.state.selection.empty && !(current.state.selection instanceof NodeSelection),
    undo: current.can().undo(), redo: current.can().redo(),
    risk: current.getAttributes('textStyle').color === RICH_TEXT_RISK_COLOR_HEX,
  }) });
  if (!visible || !editor.isEditable) return null;
  const chain = () => editor.chain().focus(undefined, { scrollIntoView: false });
  // Like a block's colour in Notion: the whole line, and the caret stays where it was.
  const markLine = () => {
    const line = lineUnitAt(editor.state.doc, editor.state.selection.from);
    if (!line) return;
    const { from, to } = editor.state.selection, range = { from: line.pos + 1, to: line.pos + line.node.nodeSize - 1 };
    const marked = chain().setTextSelection(range);
    (state.risk ? marked.unsetColor() : marked.setColor(RICH_TEXT_RISK_COLOR_HEX)).setTextSelection({ from, to }).run();
  };
  const indent = (direction: 1 | -1) => {
    for (const item of ['taskItem', 'listItem']) if (editor.isActive(item)) { (direction === 1 ? chain().sinkListItem(item) : chain().liftListItem(item)).run(); return; }
    if (editor.isActive('paragraph') && typeof (editor.commands as Record<string, unknown>).indentDocumentParagraph === 'function') chain().indentDocumentParagraph(direction).run();
  };
  return createPortal(<div ref={bar} className="ln-keyboard-bar" role="toolbar" aria-label="Editing" style={{ bottom: inset }} onPointerDown={keepFocus} onMouseDown={keepFocus}
    onBlur={event => { if (!editor.isFocused && !bar.current?.contains(event.relatedTarget as Node | null)) { setVisible(false); setLinking(false); } }} data-print-hidden>
    <div className="ln-keyboard-bar-scroll">
      {state.selected || linking ? <FormattingControls editor={editor} linking={linking} setLinking={setLinking} kinds={kinds} /> : <>
        {blocks ? <>
          <button type="button" aria-label="Insert" title="Insert (same as /)" onClick={() => { const unit = blockUnitAt(editor.state.doc, editor.state.selection.from); if (unit) addLine(editor, unit, false, openCommands); }}><Plus aria-hidden /></button>
          <button type="button" aria-label="Turn into and format" title="Turn into, format, move or delete this block" onClick={event => onBlockMenu(event.currentTarget)}><Type aria-hidden /></button>
          {insertImage ? <button type="button" aria-label="Image" title="Take or choose a photo" onClick={insertImage}><ImagePlus aria-hidden /></button> : null}
        </> : null}
        <button type="button" className="ln-selection-risk" aria-label="Risk red" title={state.risk ? 'Restore default color' : 'Mark this line in risk red'} aria-pressed={state.risk} onClick={markLine}>A</button>
        {blocks ? <>
          <button type="button" aria-label="Decrease indent" title="Decrease indent" onClick={() => indent(-1)}><IndentDecrease aria-hidden /></button>
          <button type="button" aria-label="Increase indent" title="Increase indent" onClick={() => indent(1)}><IndentIncrease aria-hidden /></button>
        </> : null}
        <button type="button" aria-label="Undo" title="Undo" disabled={!state.undo} onClick={() => chain().undo().run()}><Undo2 aria-hidden /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!state.redo} onClick={() => chain().redo().run()}><Redo2 aria-hidden /></button>
      </>}
    </div>
    <button type="button" className="ln-keyboard-bar-done" aria-label="Hide keyboard" title="Hide keyboard" onClick={() => editor.commands.blur()}><KeyboardOff aria-hidden /></button>
  </div>, document.body);
}

/**
 * On a touch screen with the keyboard down: hold a block until it lifts (a haptic tap in the app), drag it and let go where
 * the line shows; holding without moving opens its menu. While typing a long press is left to the phone, to place the caret or select.
 */
function useLongPressBlocks(editor: Editor, enabled: boolean, onMenu: (unit: BlockUnit, anchor: HTMLElement) => void) {
  const menu = useRef(onMenu);
  useEffect(() => { menu.current = onMenu; });
  useEffect(() => {
    if (!enabled) return;
    const root = editor.view.dom as HTMLElement;
    // The editor redraws a block whose classes change, and the finger's later events would go to the old, detached block;
    // so the lifted block is a copy over the page, and nothing inside the editor is touched until the drop.
    type Press = { x: number; y: number; unit: BlockUnit; dom: HTMLElement; timer: ReturnType<typeof setTimeout>; ghost: HTMLElement | null; line: HTMLElement | null; gap: number | null };
    let press: Press | null = null;
    const end = () => {
      if (!press) return;
      clearTimeout(press.timer);
      press.ghost?.remove();
      press.line?.remove();
      document.documentElement.classList.remove('ln-dragging-block');
      press = null;
    };
    const lift = () => {
      if (!press) return;
      const rect = press.dom.getBoundingClientRect(), frame = document.createElement('div'), copy = press.dom.cloneNode(true) as HTMLElement;
      frame.className = `${root.className} ln-block-ghost`;
      frame.setAttribute('aria-hidden', 'true');
      Object.assign(frame.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px` });
      frame.appendChild(copy);
      document.body.appendChild(frame);
      press.ghost = frame;
      document.documentElement.classList.add('ln-dragging-block');
      postNative({ type: 'haptic', style: 'medium' });
      navigator.vibrate?.(10);
    };
    const start = (event: TouchEvent) => {
      end();
      if (event.touches.length !== 1 || editor.isFocused || !editor.isEditable) return;
      const touch = event.touches[0];
      const found = editor.view.posAtCoords({ left: touch.clientX, top: touch.clientY });
      const unit = found ? blockUnitAt(editor.state.doc, found.inside >= 0 ? found.inside : found.pos) : null;
      const dom = unit ? editor.view.nodeDOM(unit.pos) : null;
      if (!unit || !(dom instanceof HTMLElement)) return;
      // Before the phone's own long press (about half a second) starts selecting text.
      press = { x: touch.clientX, y: touch.clientY, unit, dom, ghost: null, line: null, gap: null, timer: setTimeout(lift, 420) };
    };
    const move = (event: TouchEvent) => {
      if (!press) return;
      const touch = event.touches[0];
      if (!press.ghost) { if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > 10) end(); return; }
      event.preventDefault();
      press.ghost.style.transform = `translateY(${touch.clientY - press.y}px) scale(1.02)`;
      const $pos = editor.state.doc.resolve(press.unit.pos), parent = $pos.parent, rects: DOMRect[] = [];
      for (let index = 0, pos = $pos.start(); index < parent.childCount; pos += parent.child(index).nodeSize, index += 1) {
        const dom = editor.view.nodeDOM(pos);
        if (dom instanceof HTMLElement) rects.push(dom.getBoundingClientRect());
      }
      if (!rects.length) return;
      const after = rects.findIndex(rect => touch.clientY < (rect.top + rect.bottom) / 2);
      press.gap = after < 0 ? rects.length : after;
      const y = press.gap < rects.length ? rects[press.gap].top : rects[rects.length - 1].bottom, frame = root.getBoundingClientRect();
      if (!press.line) { press.line = document.createElement('div'); press.line.className = 'ln-block-drop-line'; document.body.appendChild(press.line); }
      Object.assign(press.line.style, { top: `${y - 1.5}px`, left: `${frame.left}px`, width: `${frame.width}px` });
      // Near the top or bottom of the screen the page follows the finger.
      const bottom = (window.visualViewport?.height ?? window.innerHeight) - 72;
      if (touch.clientY < 72) window.scrollBy(0, -12); else if (touch.clientY > bottom) window.scrollBy(0, 12);
    };
    const release = (event: TouchEvent) => {
      if (!press) return;
      if (!press.ghost) { end(); return; }
      // The hold must not also place the caret and bring up the keyboard.
      event.preventDefault();
      const { unit, dom, gap } = press;
      end();
      if (gap === null) { menu.current(unit, dom); return; }
      const current = currentBlockUnit(editor.state.doc, unit);
      const tr = current && moveBlockTo(editor.state, current, gap);
      if (tr) editor.view.dispatch(tr);
    };
    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', release);
    root.addEventListener('touchcancel', end);
    return () => {
      end();
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', release);
      root.removeEventListener('touchcancel', end);
    };
  }, [editor, enabled]);
}

/** Over the table with the caret: rows and columns where the caret is. Deleting the table is ⋮⋮. */
function TableBar({ editor, items }: { editor: Editor; items?: () => TableBarItem[] }) {
  const panel = useRef<HTMLDivElement>(null);
  const pending = useEditorPortalPending(editor, panel);
  const chain = () => editor.chain().focus(undefined, { scrollIntoView: false });
  const besideTable = useCallback(() => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) if ($from.node(depth).type.name === 'table') {
      const dom = editor.view.nodeDOM($from.before(depth));
      return dom instanceof HTMLElement ? { getBoundingClientRect: () => dom.getBoundingClientRect() } : null;
    }
    return null;
  }, [editor]);
  return <BubbleMenu editor={editor} pluginKey="tableBar" appendTo={onPage} style={{ zIndex: 55 }} options={overTable} getReferencedVirtualElement={besideTable} shouldShow={caretInTable}>
    <div ref={panel} inert={pending} className="ln-table-bar" role="toolbar" aria-label="Table" data-print-hidden onMouseDown={event => event.preventDefault()}>
      <button type="button" onClick={() => chain().addRowAfter().run()}>＋ Row</button>
      <button type="button" onClick={() => chain().addColumnAfter().run()}>＋ Column</button>
      <button type="button" onClick={() => chain().deleteRow().run()}>－ This row</button>
      <button type="button" onClick={() => chain().deleteColumn().run()}>－ This column</button>
      {items?.().map(item => <button key={item.id} type="button" onClick={item.run}>{item.label}</button>)}
    </div>
  </BubbleMenu>;
}

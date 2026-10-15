'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Copy, GripVertical, Heading2, Heading3, IndentDecrease, IndentIncrease, Italic, Link2, List, ListChecks, ListOrdered, Pilcrow, Plus, Quote, RemoveFormatting, Strikethrough, Trash2, Underline, Unlink, type LucideIcon } from 'lucide-react';
import { setSelectionFontSize } from '@/lib/document-text-formatting';
import { RICH_TEXT_FONT_SIZES_PT } from '@/lib/rich-text-font-size';
import { RICH_TEXT_LINE_HEIGHTS } from '@/lib/rich-text-line-height';
import { RICH_TEXT_RISK_COLOR_HEX } from '@/lib/rich-text-color';
import { endBlockDrag, setBlockHandleHandlers, startBlockDrag, type BlockHover } from '@/lib/editor-block-handle';
import { blockKind, blockTakesFormat, blockTakesKinds, canDuplicateBlock, currentBlockUnit, deleteBlock, duplicateBlock, moveBlock, selectBlock, turnInto, type BlockKind, type BlockUnit } from '@/lib/editor-blocks';
import type { MenuAnchor } from '@/lib/editor-slash';
import { useAnchoredPosition, useDismiss } from './protocol/popover';
import './editor-surface.css';

export type BlockMenuItem = { id: string; label: string; icon: LucideIcon; run: (unit: BlockUnit, anchor: MenuAnchor) => void };
type TableBarItem = { id: string; label: string; run: () => void };
type EditorSurfaceProps = {
  editor: Editor;
  /** ＋ and ⋮⋮ beside the blocks; an editor inside a widget has only the bubble. */
  handles?: boolean;
  /** The kinds 转换为 offers in this editor (a Protocol has no checklist). */
  kinds?: BlockKind[];
  /** ＋ opens this editor's "/" menu with its own search field. */
  openCommands: (anchor: MenuAnchor) => void;
  /** Items only this editor has, e.g. a Protocol block's 适用范围. */
  blockItems?: (unit: BlockUnit) => BlockMenuItem[];
  tableItems?: () => TableBarItem[];
  /** After ⋮⋮ deleted a block, e.g. to drop a Protocol block's 适用范围 rules. */
  afterDelete?: (unit: BlockUnit) => void;
  children: ReactNode;
};

const kindChoices: Array<{ kind: BlockKind; label: string; icon: LucideIcon }> = [
  { kind: 'paragraph', label: '正文', icon: Pilcrow }, { kind: 'heading', label: '标题', icon: Heading2 }, { kind: 'subheading', label: '小标题', icon: Heading3 }, { kind: 'quote', label: '引用', icon: Quote },
  { kind: 'bullet', label: '项目列表', icon: List }, { kind: 'ordered', label: '编号列表', icon: ListOrdered }, { kind: 'task', label: '待办清单', icon: ListChecks },
];
const allKinds = kindChoices.map(choice => choice.kind);

/** The first line of a block, to set its handle beside it. */
function firstLine(view: EditorView, unit: BlockUnit) {
  let textPos = unit.node.isTextblock ? unit.pos + 1 : null;
  if (textPos === null) unit.node.descendants((node, pos) => { if (textPos !== null) return false; if (node.isTextblock) { textPos = unit.pos + 2 + pos; return false; } return true; });
  if (textPos === null) return null;
  try { const { top, bottom } = view.coordsAtPos(textPos); return { top, bottom }; } catch { return null; }
}

/**
 * The page an editor is written on, Notion-style: ＋ and ⋮⋮ beside the block under the pointer, a bubble over selected text,
 * and a bar over the table with the caret. There is no toolbar: everything else is "/" or a shortcut.
 */
export function EditorSurface({ editor, handles = true, kinds = allKinds, openCommands, blockItems, tableItems, afterDelete, children }: EditorSurfaceProps) {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<BlockHover | null>(null);
  const [menu, setMenu] = useState<{ unit: BlockUnit; anchor: HTMLElement } | null>(null);
  const [linking, setLinking] = useState(false);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While a block's menu is open, its handle stays with it.
  const menuOpen = useRef(false);
  useEffect(() => { menuOpen.current = Boolean(menu); }, [menu]);
  useEffect(() => {
    setBlockHandleHandlers(editor, { show: handles ? next => { if (menuOpen.current) return; if (leave.current) clearTimeout(leave.current); setHover(next); } : null, link: () => setLinking(true) });
    return () => setBlockHandleHandlers(editor, { show: null, link: null });
  }, [editor, handles]);
  useEffect(() => () => { if (leave.current) clearTimeout(leave.current); }, []);
  const stay = () => { if (leave.current) clearTimeout(leave.current); };
  // Crossing the margin to the handle must not hide it.
  const later = () => { stay(); leave.current = setTimeout(() => { if (!menuOpen.current) setHover(null); }, 320); };
  return <div ref={setSurface} className="ln-editor-surface" onMouseLeave={later} onMouseEnter={stay}>
    {children}
    {hover && surface ? <BlockHandle key={hover.unit.pos} editor={editor} hover={hover} surface={surface} menuOpen={Boolean(menu)} onMenu={anchor => setMenu(current => current ? null : { unit: hover.unit, anchor })} openCommands={openCommands} onEnter={stay} /> : null}
    {menu ? <BlockMenu editor={editor} unit={menu.unit} anchor={menu.anchor} kinds={kinds} blockItems={blockItems} afterDelete={afterDelete} openCommands={openCommands} onClose={() => { setMenu(null); setHover(null); }} /> : null}
    <SelectionBubble editor={editor} linking={linking} setLinking={setLinking} />
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
    const left = box.current?.getBoundingClientRect().left;
    if (place && left !== undefined && left < 2) setPlace({ ...place, left: place.left + (2 - left) / place.scale });
  }, [place]);
  if (!place) return null;
  const dragStart = (event: React.DragEvent<HTMLButtonElement>) => { const unit = currentBlockUnit(editor.state.doc, hover.unit); if (unit) startBlockDrag(editor.view, unit, event.dataTransfer, hover.dom); };
  return <div ref={box} className="ln-block-handle" style={{ top: place.top, left: place.left }} data-open={menuOpen || undefined} contentEditable={false} data-print-hidden onMouseEnter={onEnter}>
    <button type="button" className="focus-ring" aria-label="在下方插入（按住 ⌥ 在上方）" title="在下方插入 · ⌥ 在上方" onMouseDown={event => event.preventDefault()} onClick={event => addLine(editor, hover.unit, event.altKey, openCommands)}><Plus aria-hidden /></button>
    <button type="button" className="focus-ring" draggable aria-label="拖动移动，点击打开菜单" title="拖动移动 · 点击打开菜单" aria-haspopup="menu" aria-expanded={menuOpen}
      onDragStart={dragStart} onDragEnd={() => endBlockDrag(editor.view)} onClick={event => onMenu(event.currentTarget)}><GripVertical aria-hidden /></button>
  </div>;
}

function BlockMenu({ editor, unit: opened, anchor, kinds, blockItems, afterDelete, openCommands, onClose }: { editor: Editor; unit: BlockUnit; anchor: HTMLElement; kinds: BlockKind[]; blockItems?: EditorSurfaceProps['blockItems']; afterDelete?: EditorSurfaceProps['afterDelete']; openCommands: EditorSurfaceProps['openCommands']; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
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
  return createPortal(<div ref={panel} className="ln-block-menu" style={style} role="menu" aria-label="块操作">
    {choices.length ? <section aria-label="转换为"><p>转换为</p><div className="ln-block-menu-kinds">
      {choices.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" role="menuitemradio" aria-checked={current === kind} onClick={() => run(() => turnInto(editor, selectBlock(editor, unit), kind).run())}><Icon aria-hidden /><span>{label}</span></button>)}
    </div></section> : null}
    {blockTakesFormat(unit.node) ? <section aria-label="格式"><p>格式</p>
      <div className="ln-block-menu-row" role="group" aria-label="对齐">
        {([['left', AlignLeft, '左对齐'], ['center', AlignCenter, '居中'], ['right', AlignRight, '右对齐'], ['justify', AlignJustify, '两端对齐']] as const).map(([align, Icon, label]) =>
          <button key={align} type="button" role="menuitemradio" aria-checked={(attrs.textAlign ?? 'left') === align} aria-label={label} title={label} onClick={() => run(() => selectBlock(editor, unit).setTextAlign(align).run())}><Icon aria-hidden /></button>)}
        <span className="ln-block-menu-gap" />
        <button type="button" role="menuitem" aria-label="减少缩进" title="减少缩进" disabled={unit.node.type.name !== 'paragraph'} onClick={() => run(() => selectBlock(editor, unit).indentDocumentParagraph(-1).run())}><IndentDecrease aria-hidden /></button>
        <button type="button" role="menuitem" aria-label="增加缩进" title="增加缩进" disabled={unit.node.type.name !== 'paragraph'} onClick={() => run(() => selectBlock(editor, unit).indentDocumentParagraph(1).run())}><IndentIncrease aria-hidden /></button>
      </div>
      <label className="ln-block-menu-field"><span>字号</span><select defaultValue="" onChange={event => { const value = event.target.value; run(() => { selectBlock(editor, unit).run(); setSelectionFontSize(editor, value === 'default' ? null : Number(value)); }); }}>
        <option value="" disabled>选择…</option><option value="default">默认</option>{RICH_TEXT_FONT_SIZES_PT.map(size => <option key={size} value={size}>{size} pt</option>)}
      </select></label>
      <label className="ln-block-menu-field"><span>行距</span><select defaultValue={String(attrs.documentLineHeight ?? '')} onChange={event => { const value = event.target.value; run(() => selectBlock(editor, unit).setDocumentBlockLineHeight(value).run()); }}>
        <option value="" disabled>默认</option>{RICH_TEXT_LINE_HEIGHTS.map(height => <option key={height} value={String(height)}>{height}×</option>)}
      </select></label>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => selectBlock(editor, unit).unsetAllMarks().resetAttributes('paragraph', ['textAlign', 'documentIndent', 'spaceBeforePt', 'spaceAfterPt', 'documentLineHeight']).resetAttributes('heading', ['textAlign', 'documentLineHeight']).run())}><RemoveFormatting aria-hidden />清除格式</button>
    </section> : null}
    {items.length ? <section aria-label="此块">{items.map(({ id, label, icon: Icon, run: action }) => <button key={id} type="button" role="menuitem" className="ln-block-menu-item" onClick={() => { const { top, left, bottom } = anchor.getBoundingClientRect(); run(() => action(unit, { top, left, bottom })); }}><Icon aria-hidden />{label}</button>)}</section> : null}
    <section aria-label="块">
      {/* Touch screens have no ＋ beside the block: it is here instead. */}
      <button type="button" role="menuitem" className="ln-block-menu-item is-touch" onClick={() => run(() => addLine(editor, unit, false, openCommands))}><Plus aria-hidden />在下方插入…</button>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => dispatch(moveBlock(editor.state, unit, -1)))}><ArrowUp aria-hidden />上移<kbd>⌘⇧↑</kbd></button>
      <button type="button" role="menuitem" className="ln-block-menu-item" onClick={() => run(() => dispatch(moveBlock(editor.state, unit, 1)))}><ArrowDown aria-hidden />下移<kbd>⌘⇧↓</kbd></button>
      <button type="button" role="menuitem" className="ln-block-menu-item" disabled={!canDuplicateBlock(unit)} onClick={() => run(() => dispatch(duplicateBlock(editor.state, unit)))}><Copy aria-hidden />复制</button>
      <button type="button" role="menuitem" className="ln-block-menu-item is-danger" onClick={() => run(() => { dispatch(deleteBlock(editor.state, unit)); afterDelete?.(unit); })}><Trash2 aria-hidden />{media ? '移除（保留原文件）' : '删除'}</button>
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

/** Over selected text: the marks, a link and the risk colour. */
function SelectionBubble({ editor, linking, setLinking }: { editor: Editor; linking: boolean; setLinking: (value: boolean) => void }) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), strike: current.isActive('strike'),
    link: current.getAttributes('link').href as string | undefined, risk: current.getAttributes('textStyle').color === RICH_TEXT_RISK_COLOR_HEX,
  }) });
  const [href, setHref] = useState('');
  const chain = () => editor.chain().focus(undefined, { scrollIntoView: false });
  const marks: Array<[keyof typeof state, LucideIcon, string, () => void]> = [
    ['bold', Bold, '加粗 ⌘B', () => chain().toggleBold().run()], ['italic', Italic, '斜体 ⌘I', () => chain().toggleItalic().run()],
    ['underline', Underline, '下划线 ⌘U', () => chain().toggleUnderline().run()], ['strike', Strikethrough, '删除线 ⌘⇧S', () => chain().toggleStrike().run()],
  ];
  // An empty address removes the link.
  const applyLink = (value: string) => { const range = chain().extendMarkRange('link'); (value ? range.setLink({ href: value }) : range.unsetLink()).run(); setLinking(false); };
  return <BubbleMenu editor={editor} pluginKey="selectionBubble" appendTo={onPage} style={{ zIndex: 60 }} options={overText} shouldShow={textSelected}>
    <div className="ln-selection-bubble" role="toolbar" aria-label="文字格式" data-print-hidden onMouseDown={event => { if (!(event.target instanceof HTMLInputElement)) event.preventDefault(); }}>
      {/* No <form> here: the editor sits inside the page's form, and React would pass a submit up to it. */}
      {linking ? <div className="ln-selection-link">
        <input autoFocus value={href} onChange={event => setHref(event.target.value)} placeholder="粘贴或输入链接，回车确定" aria-label="链接地址" onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Enter') { event.preventDefault(); applyLink(href.trim()); }
          else if (event.key === 'Escape') { event.preventDefault(); setLinking(false); editor.view.focus(); }
        }} />
        {state.link ? <button type="button" aria-label="移除链接" title="移除链接" onClick={() => applyLink('')}><Unlink aria-hidden /></button> : null}
      </div> : <>
        {marks.map(([key, Icon, label, toggle]) => <button key={key} type="button" aria-label={label} title={label} aria-pressed={Boolean(state[key])} onClick={toggle}><Icon aria-hidden /></button>)}
        <span className="ln-selection-divider" aria-hidden />
        <button type="button" aria-label="链接 ⌘K" title="链接 ⌘K" aria-pressed={Boolean(state.link)} onClick={() => { setHref(state.link ?? ''); setLinking(true); }}><Link2 aria-hidden /></button>
        <button type="button" className="ln-selection-risk" aria-label="风险红" title={state.risk ? '恢复默认颜色' : '标为风险红'} aria-pressed={state.risk} onClick={() => (state.risk ? chain().unsetColor() : chain().setColor(RICH_TEXT_RISK_COLOR_HEX)).run()}>A</button>
      </>}
    </div>
  </BubbleMenu>;
}

/** Over the table with the caret: rows and columns where the caret is. Deleting the table is ⋮⋮. */
function TableBar({ editor, items }: { editor: Editor; items?: () => TableBarItem[] }) {
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
    <div className="ln-table-bar" role="toolbar" aria-label="表格" data-print-hidden onMouseDown={event => event.preventDefault()}>
      <button type="button" onClick={() => chain().addRowAfter().run()}>＋ 行</button>
      <button type="button" onClick={() => chain().addColumnAfter().run()}>＋ 列</button>
      <button type="button" onClick={() => chain().deleteRow().run()}>－ 本行</button>
      <button type="button" onClick={() => chain().deleteColumn().run()}>－ 本列</button>
      {items?.().map(item => <button key={item.id} type="button" onClick={item.run}>{item.label}</button>)}
    </div>
  </BubbleMenu>;
}

"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Bold, ChevronDown, Italic, Link2, List, ListChecks, ListOrdered, Pencil, Plus, Quote, Redo2, Save, Strikethrough, Table2, Trash2, Underline, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/cn";
import { RICH_TEXT_RISK_COLOR_HEX } from "@/lib/rich-text-color";
import { RICH_TEXT_FONT_SIZES_PT } from "@/lib/rich-text-font-size";
import { RICH_TEXT_LINE_HEIGHTS } from "@/lib/rich-text-line-height";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { richTextFontOptions } from "@/lib/rich-text-font-family";
import { editorNamedStylesStorageKey, editorStyleNameExists, parseEditorNamedStyles, upsertEditorNamedStyle, type EditorNamedStyle } from "@/lib/editor-named-styles";
import { listCustomFonts, loadCustomFont } from "@/lib/custom-font-storage";
import type { CustomFontRecord } from "@/lib/typography-settings";

export const wysiwygToolbarButtonClass = "focus-ring inline-flex h-[var(--ln-wysiwyg-toolbar-control-height)] min-w-[var(--ln-wysiwyg-toolbar-control-height)] items-center justify-center rounded-[var(--ln-wysiwyg-toolbar-radius)] border border-transparent px-[var(--ln-wysiwyg-toolbar-button-padding-x)] text-muted transition-colors hover:bg-stone hover:text-ink disabled:opacity-35";
export const wysiwygToolbarSelectClass = "focus-ring h-[var(--ln-wysiwyg-toolbar-control-height)] min-w-0 rounded-[var(--ln-wysiwyg-toolbar-radius)] border border-hairline bg-surface px-[var(--ln-wysiwyg-toolbar-select-padding-x)] text-[length:var(--ln-wysiwyg-toolbar-font-size)] text-graphite";
export const wysiwygWidgetInputClass = "focus-ring h-[var(--ln-wysiwyg-widget-control-height)] min-w-0 rounded-[var(--ln-wysiwyg-toolbar-radius)] border border-hairline bg-surface px-[var(--ln-wysiwyg-widget-control-padding-x)] text-[length:var(--ln-wysiwyg-widget-font-size)] text-ink";

export type WysiwygInsertAction = {
  id: string;
  icon: ReactNode;
  label: string;
  description: string;
  run: (editor: Editor) => void;
};

function ToolbarButton({ editor, active, disabled, label, onClick, children }: {
  editor: Editor;
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return <button type="button" className={cn(wysiwygToolbarButtonClass, active && "bg-action-surface/65 font-semibold text-moss")} aria-label={label} title={label} aria-pressed={active || undefined} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { onClick(); editor.commands.focus(); }}>{children}</button>;
}

function selectedFontFamily(editor: Editor): string {
  const families = new Set<string>();
  const { from, to, empty } = editor.state.selection;
  if (empty) return editor.getAttributes("textStyle").fontFamily ?? "";
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const fontFamily = node.marks.find((mark) => mark.type.name === "textStyle")?.attrs.fontFamily;
    families.add(typeof fontFamily === "string" ? fontFamily : "");
  });
  return families.size > 1 ? "__mixed__" : [...families][0] ?? "";
}

function FontFamilyCombobox({ editor, options, value }: { editor: Editor; options: Array<{ value: string; label: string }>; value: string }) {
  const listId = useId();
  const defaultLabel = "Times New Roman / 思源宋体";
  const selectedLabel = value === "__mixed__" ? "Mixed fonts" : options.find((option) => option.value === value)?.label ?? defaultLabel;
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const apply = () => {
    const normalized = query.trim().toLocaleLowerCase();
    const option = options.find((item) => item.label.toLocaleLowerCase() === normalized || item.value.toLocaleLowerCase() === normalized);
    if (option) editor.chain().focus().setFontFamily(option.value).run();
    else if (!normalized || normalized === defaultLabel.toLocaleLowerCase()) editor.chain().focus().unsetFontFamily().run();
    setEditing(false);
  };
  return <><input
    className={`${wysiwygToolbarSelectClass} ln-wysiwyg-font-select`}
    aria-label="Font"
    title="Search font family"
    list={listId}
    value={editing ? query : selectedLabel}
    onFocus={() => { setEditing(true); setQuery(value === "__mixed__" ? "" : selectedLabel); }}
    onChange={(event) => setQuery(event.target.value)}
    onBlur={apply}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(); } }}
  /><datalist id={listId}>{options.map((option) => <option key={option.value} value={option.label}>{option.value}</option>)}</datalist></>;
}

function ToolbarMenu({
  id,
  label,
  icon,
  openMenu,
  setOpenMenu,
  children,
  menuClassName,
  triggerClassName,
}: {
  id: string;
  label: string;
  icon?: ReactNode;
  openMenu: string | null;
  setOpenMenu: Dispatch<SetStateAction<string | null>>;
  children: ReactNode;
  menuClassName: string;
  triggerClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuPosition, setMenuPosition] = useState<CSSProperties>();
  const open = openMenu === id;
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportMargin = 8;
    const availableBelow = window.innerHeight - triggerRect.bottom - viewportMargin;
    const availableAbove = triggerRect.top - viewportMargin;
    const placeAbove = availableBelow < Math.min(menuRect.height, 240) && availableAbove > availableBelow;
    const top = placeAbove
      ? Math.max(viewportMargin, triggerRect.top - menuRect.height - 6)
      : Math.min(window.innerHeight - viewportMargin, triggerRect.bottom + 6);
    const preferredLeft = id === "more" || id === "table"
      ? triggerRect.right - menuRect.width
      : triggerRect.left;
    const left = Math.min(
      Math.max(viewportMargin, preferredLeft),
      Math.max(viewportMargin, window.innerWidth - menuRect.width - viewportMargin),
    );
    setMenuPosition({
      left,
      maxHeight: Math.max(120, placeAbove ? availableAbove - 6 : availableBelow),
      maxWidth: `calc(100vw - ${viewportMargin * 2}px)`,
      overflowY: "auto",
      position: "fixed",
      right: "auto",
      top,
      zIndex: 80,
    });
  }, [id]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        rootRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    const animationFrame = window.requestAnimationFrame(updateMenuPosition);
    globalThis.document.addEventListener("pointerdown", dismiss);
    globalThis.document.addEventListener("keydown", escape);
    globalThis.addEventListener("resize", updateMenuPosition);
    globalThis.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      globalThis.document.removeEventListener("pointerdown", dismiss);
      globalThis.document.removeEventListener("keydown", escape);
      globalThis.removeEventListener("resize", updateMenuPosition);
      globalThis.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, setOpenMenu, updateMenuPosition]);

  return <div ref={rootRef} className="ln-wysiwyg-insert-menu">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-controls={menuId} aria-expanded={open} className={cn(wysiwygToolbarButtonClass, "border-hairline bg-surface text-graphite", triggerClassName)} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpenMenu((current) => current === id ? null : id)}>{icon}<span>{label}</span><ChevronDown aria-hidden /></button>
    {open && typeof document !== "undefined" ? createPortal(<div ref={menuRef} id={menuId} role="menu" className={menuClassName} style={menuPosition} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { if ((event.target as HTMLElement).closest("button")) setOpenMenu(null); }}>{children}</div>, document.body) : null}
  </div>;
}

/**
 * Deep formatting Module shared by every LabNest Tiptap adapter. Callers only
 * provide domain-specific insert actions; formatting behaviour stays local.
 */
export function DocumentWysiwygToolbar({
  editor,
  ariaLabel,
  insertActions = [],
  checklist = true,
  className,
}: {
  editor: Editor;
  ariaLabel: string;
  insertActions?: WysiwygInsertAction[];
  checklist?: boolean;
  className?: string;
}) {
  const dialog = useModalDialog();
  const [, setRevision] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [namedStyles, setNamedStyles] = useState<EditorNamedStyle[]>(() => typeof window === "undefined" ? [] : parseEditorNamedStyles(window.localStorage.getItem(editorNamedStylesStorageKey)));
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  useEffect(() => {
    let active = true;
    void listCustomFonts().then(async (fonts) => {
      await Promise.allSettled(fonts.map(loadCustomFont));
      if (active) setCustomFonts(fonts);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => { editor.off("selectionUpdate", refresh); editor.off("transaction", refresh); };
  }, [editor]);

  const paragraphType = editor.isActive("heading", { level: 2 }) ? "heading2" : editor.isActive("heading", { level: 3 }) ? "heading3" : "paragraph";
  const textStyle = editor.getAttributes("textStyle");
  const fontOptions = [
    ...richTextFontOptions,
    ...customFonts.map((font) => ({ value: `labnest-custom-${font.id}`, label: font.name })),
  ];
  const setLink = async () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = await dialog.prompt({ title: "Insert link", inputLabel: "Link URL", defaultValue: current ?? "https://", confirmLabel: "Apply link" });
    if (href === null) return;
    if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };
  const applyNamedStyle = (style: EditorNamedStyle) => {
    let chain = editor.chain().focus();
    chain = style.paragraphType === "heading2" ? chain.setHeading({ level: 2 }) : style.paragraphType === "heading3" ? chain.setHeading({ level: 3 }) : chain.setParagraph();
    chain = style.fontFamily ? chain.setFontFamily(style.fontFamily) : chain.unsetFontFamily();
    chain = style.fontSize ? chain.setFontSize(style.fontSize) : chain.unsetFontSize();
    chain = style.lineHeight ? chain.setLineHeight(style.lineHeight) : chain.unsetLineHeight();
    chain = style.color ? chain.setColor(style.color) : chain.unsetColor();
    chain.run();
    const mark = (name: "bold" | "italic" | "underline", enabled?: boolean) => {
      if (editor.isActive(name) === Boolean(enabled)) return;
      if (name === "bold") editor.chain().focus().toggleBold().run();
      else if (name === "italic") editor.chain().focus().toggleItalic().run();
      else editor.chain().focus().toggleUnderline().run();
    };
    mark("bold", style.bold); mark("italic", style.italic); mark("underline", style.underline);
    if (editor.isActive("strike") !== Boolean(style.strike)) editor.chain().focus().toggleStrike().run();
  };
  const persistNamedStyles = (next: EditorNamedStyle[]) => {
    setNamedStyles(next);
    window.localStorage.setItem(editorNamedStylesStorageKey, JSON.stringify(next));
  };
  const saveCurrentStyle = async () => {
    const name = await dialog.prompt({ title: "Save text style", inputLabel: "Style name", confirmLabel: "Save style" });
    if (!name?.trim()) return;
    if (editorStyleNameExists(namedStyles, name)) {
      await dialog.alert({ title: "Style name already exists", description: "Choose a different name for this text style." });
      return;
    }
    const id = `style-${crypto.randomUUID?.() ?? Date.now()}`;
    const now = new Date().toISOString();
    persistNamedStyles(upsertEditorNamedStyle(namedStyles, {
      schemaVersion: 1,
      id,
      name: name.trim(),
      paragraphType,
      fontFamily: textStyle.fontFamily || undefined,
      fontSize: textStyle.fontSize || undefined,
      lineHeight: textStyle.lineHeight || undefined,
      bold: editor.isActive("bold") || undefined,
      italic: editor.isActive("italic") || undefined,
      underline: editor.isActive("underline") || undefined,
      strike: editor.isActive("strike") || undefined,
      color: textStyle.color || undefined,
      createdAt: now,
      updatedAt: now,
    }));
  };
  const renameStyle = async (style: EditorNamedStyle) => {
    const name = await dialog.prompt({ title: "Rename text style", inputLabel: "Style name", defaultValue: style.name, confirmLabel: "Rename style" });
    if (!name?.trim()) return;
    if (editorStyleNameExists(namedStyles, name, style.id)) {
      await dialog.alert({ title: "Style name already exists", description: "Choose a different name for this text style." });
      return;
    }
    persistNamedStyles(upsertEditorNamedStyle(namedStyles, { ...style, name: name.trim(), updatedAt: new Date().toISOString() }));
  };

  return <div className={cn("ln-wysiwyg-toolbar", className)} role="toolbar" aria-label={ariaLabel}>
    <select className={`${wysiwygToolbarSelectClass} ln-wysiwyg-style-select`} value={paragraphType} onChange={(event) => {
      if (event.target.value.startsWith("named:")) {
        const style = namedStyles.find((item) => item.id === event.target.value.slice(6));
        if (style) applyNamedStyle(style);
      } else if (event.target.value === "heading2") editor.chain().focus().setHeading({ level: 2 }).run();
      else if (event.target.value === "heading3") editor.chain().focus().setHeading({ level: 3 }).run();
      else editor.chain().focus().setParagraph().run();
    }} aria-label="Paragraph style"><option value="paragraph">Body</option><option value="heading2">Heading 2</option><option value="heading3">Heading 3</option>{namedStyles.length ? <optgroup label="My styles">{namedStyles.map((style) => <option key={style.id} value={`named:${style.id}`}>{style.name}</option>)}</optgroup> : null}</select>
    <span className="ln-wysiwyg-toolbar-divider" aria-hidden />
    <ToolbarButton editor={editor} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline aria-hidden /></ToolbarButton>
    <FontFamilyCombobox editor={editor} options={fontOptions} value={selectedFontFamily(editor)} />
    <select className={`${wysiwygToolbarSelectClass} ln-wysiwyg-size-select`} value={textStyle.fontSize ?? ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()} aria-label="Font size"><option value="">Size</option>{RICH_TEXT_FONT_SIZES_PT.map((size) => <option key={size} value={`${size}pt`}>{size}</option>)}</select>
    <select className={`${wysiwygToolbarSelectClass} ln-wysiwyg-line-height-select`} value={textStyle.lineHeight ?? ""} onChange={(event) => event.target.value ? editor.chain().focus().setLineHeight(event.target.value).run() : editor.chain().focus().unsetLineHeight().run()} aria-label="Line spacing"><option value="">1.6×</option>{RICH_TEXT_LINE_HEIGHTS.map((height) => <option key={height} value={String(height)}>{height}×</option>)}</select>
    <span className="ln-wysiwyg-toolbar-divider" aria-hidden />
    <ToolbarButton editor={editor} label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered aria-hidden /></ToolbarButton>
    {checklist ? <ToolbarButton editor={editor} label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks aria-hidden /></ToolbarButton> : null}
    <ToolbarMenu id="more" label="More" openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu" triggerClassName="ln-wysiwyg-more-menu-trigger">
        <button type="button" data-active={editor.isActive("strike") || undefined} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough aria-hidden />Strikethrough</button>
        <button type="button" data-active={editor.isActive("blockquote") || undefined} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote aria-hidden />Quote</button>
        <button type="button" data-active={editor.isActive("link") || undefined} onClick={setLink}><Link2 aria-hidden />Add / edit link</button>
        <button type="button" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink aria-hidden />Remove link</button>
        <button type="button" onClick={() => editor.chain().focus().unsetColor().run()}><span aria-hidden>A</span>Default gray</button>
        <button type="button" onClick={() => editor.chain().focus().setColor(RICH_TEXT_RISK_COLOR_HEX).run()}><span className="text-error" aria-hidden>A</span>Risk red</button>
        <button type="button" onClick={saveCurrentStyle}><Save aria-hidden />Save selection as style</button>
        {namedStyles.flatMap((style) => [
          <button key={`rename-${style.id}`} type="button" onClick={() => renameStyle(style)}><Pencil aria-hidden />Rename style: {style.name}</button>,
          <button key={`delete-${style.id}`} type="button" onClick={() => persistNamedStyles(namedStyles.filter((item) => item.id !== style.id))}><Trash2 aria-hidden />Delete style: {style.name}</button>,
        ])}
    </ToolbarMenu>
    {insertActions.length ? <ToolbarMenu id="insert" label="Insert" icon={<Plus aria-hidden />} openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-insert-popover" triggerClassName="ln-wysiwyg-insert-menu-trigger">
        {insertActions.map((action) => <button key={action.id} type="button" onClick={() => action.run(editor)}>{action.icon}<span><strong>{action.label}</strong><small>{action.description}</small></span></button>)}
    </ToolbarMenu> : null}
    {editor.isActive("table") ? <ToolbarMenu id="table" label="Table" icon={<Table2 aria-hidden />} openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu"><button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button><button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</button><button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</button><button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</button><button type="button" className="text-error" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button></ToolbarMenu> : null}
    <span className="ln-wysiwyg-toolbar-spacer" />
    <ToolbarButton editor={editor} label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 aria-hidden /></ToolbarButton>
  </div>;
}

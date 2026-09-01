"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Editor } from "@tiptap/core";
import { Bold, ChevronDown, Italic, Link2, List, ListChecks, ListOrdered, Plus, Quote, Redo2, Strikethrough, Table2, Underline, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/cn";
import { RICH_TEXT_RISK_COLOR_HEX } from "@/lib/rich-text-color";
import { RICH_TEXT_FONT_SIZES_PT } from "@/lib/rich-text-font-size";
import { RICH_TEXT_LINE_HEIGHTS } from "@/lib/rich-text-line-height";

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
  const open = openMenu === id;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        rootRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    globalThis.document.addEventListener("pointerdown", dismiss);
    globalThis.document.addEventListener("keydown", escape);
    return () => {
      globalThis.document.removeEventListener("pointerdown", dismiss);
      globalThis.document.removeEventListener("keydown", escape);
    };
  }, [open, setOpenMenu]);

  return <div ref={rootRef} className="ln-wysiwyg-insert-menu">
    <button type="button" aria-haspopup="menu" aria-expanded={open} className={cn(wysiwygToolbarButtonClass, "border-hairline bg-surface text-graphite", triggerClassName)} onClick={() => setOpenMenu((current) => current === id ? null : id)}>{icon}<span>{label}</span><ChevronDown aria-hidden /></button>
    {open ? <div role="menu" className={menuClassName} onClick={() => setOpenMenu(null)}>{children}</div> : null}
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
  const [, setRevision] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => { editor.off("selectionUpdate", refresh); editor.off("transaction", refresh); };
  }, [editor]);

  const paragraphType = editor.isActive("heading", { level: 2 }) ? "heading2" : editor.isActive("heading", { level: 3 }) ? "heading3" : "paragraph";
  const textStyle = editor.getAttributes("textStyle");
  const setLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "https://");
    if (href === null) return;
    if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return <div className={cn("ln-wysiwyg-toolbar", className)} role="toolbar" aria-label={ariaLabel}>
    <select className={`${wysiwygToolbarSelectClass} ln-wysiwyg-style-select`} value={paragraphType} onChange={(event) => {
      if (event.target.value === "heading2") editor.chain().focus().setHeading({ level: 2 }).run();
      else if (event.target.value === "heading3") editor.chain().focus().setHeading({ level: 3 }).run();
      else editor.chain().focus().setParagraph().run();
    }} aria-label="Paragraph style"><option value="paragraph">Body</option><option value="heading2">Heading 2</option><option value="heading3">Heading 3</option></select>
    <span className="ln-wysiwyg-toolbar-divider" aria-hidden />
    <ToolbarButton editor={editor} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline aria-hidden /></ToolbarButton>
    <select className={`${wysiwygToolbarSelectClass} ln-wysiwyg-font-select`} value={textStyle.fontFamily ?? ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()} aria-label="Font"><option value="">Font</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select>
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
    </ToolbarMenu>
    {insertActions.length ? <ToolbarMenu id="insert" label="Insert" icon={<Plus aria-hidden />} openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-insert-popover">
        {insertActions.map((action) => <button key={action.id} type="button" onClick={() => action.run(editor)}>{action.icon}<span><strong>{action.label}</strong><small>{action.description}</small></span></button>)}
    </ToolbarMenu> : null}
    {editor.isActive("table") ? <ToolbarMenu id="table" label="Table" icon={<Table2 aria-hidden />} openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu"><button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button><button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</button><button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</button><button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</button><button type="button" className="text-error" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button></ToolbarMenu> : null}
    <span className="ln-wysiwyg-toolbar-spacer" />
    <ToolbarButton editor={editor} label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 aria-hidden /></ToolbarButton>
  </div>;
}

"use client";

import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Bold, ChevronDown, Italic, Link2, List, ListChecks, ListOrdered, Pencil, Plus, Quote, Redo2, Save, Strikethrough, Table2, Trash2, Underline, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/cn";
import { RICH_TEXT_RISK_COLOR_HEX } from "@/lib/rich-text-color";
import { RICH_TEXT_FONT_SIZES_PT } from "@/lib/rich-text-font-size";
import { RICH_TEXT_LINE_HEIGHTS } from "@/lib/rich-text-line-height";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { richTextFontFamilyCss, richTextFontOptions } from "@/lib/rich-text-font-family";
import { editorNamedStylesStorageKey, editorStyleNameExists, parseEditorNamedStyles, upsertEditorNamedStyle, type EditorNamedStyle } from "@/lib/editor-named-styles";
import { listCustomFonts, loadCustomFont } from "@/lib/custom-font-storage";
import type { CustomFontRecord } from "@/lib/typography-settings";
import { loadStoredLocalFontFamilies, type LocalFontFamilyRecord } from "@/lib/local-font-catalog";

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

function ToolbarMenu({
  id,
  label,
  ariaLabel,
  icon,
  openMenu,
  setOpenMenu,
  children,
  menuClassName,
  triggerClassName,
}: {
  id: string;
  label: string;
  ariaLabel?: string;
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
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({ position: "fixed", visibility: "hidden", zIndex: 120 });
  const open = openMenu === id;
  const assignMenuRef = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    if (node) window.requestAnimationFrame(() => node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  }, []);
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
      visibility: "visible",
    });
  }, [id]);
  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);
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
    globalThis.document.addEventListener("pointerdown", dismiss);
    globalThis.document.addEventListener("keydown", escape);
    globalThis.addEventListener("resize", updateMenuPosition);
    globalThis.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      globalThis.document.removeEventListener("pointerdown", dismiss);
      globalThis.document.removeEventListener("keydown", escape);
      globalThis.removeEventListener("resize", updateMenuPosition);
      globalThis.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, setOpenMenu, updateMenuPosition]);

  const menuItems = Children.map(children, (child) => isValidElement(child)
    ? cloneElement(child as ReactElement<{ role?: string; tabIndex?: number }>, { role: "menuitem", tabIndex: -1 })
    : child);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!buttons.length) return;
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? buttons.length - 1
          : (currentIndex + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
      return;
    }
    if (event.key === "Tab") {
      setOpenMenu(null);
      const toolbar = rootRef.current?.closest('[role="toolbar"]');
      const controls = [...(toolbar?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') ?? [])];
      const triggerIndex = controls.indexOf(triggerRef.current as HTMLButtonElement);
      const nextIndex = triggerIndex + (event.shiftKey ? -1 : 1);
      if (nextIndex >= 0 && nextIndex < controls.length) {
        event.preventDefault();
        controls[nextIndex]?.focus();
      } else {
        triggerRef.current?.focus();
      }
    }
  };

  return <div ref={rootRef} className="ln-wysiwyg-insert-menu">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-controls={menuId} aria-expanded={open} aria-label={ariaLabel ?? label} title={ariaLabel ?? label} className={cn(wysiwygToolbarButtonClass, "border-hairline bg-surface text-graphite", triggerClassName)} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpenMenu((current) => current === id ? null : id)}>{icon}<span>{label}</span><ChevronDown aria-hidden /></button>
    {open && typeof document !== "undefined" ? createPortal(<div ref={assignMenuRef} id={menuId} role="menu" data-toolbar-menu={id} className={menuClassName} style={menuPosition} onMouseDown={(event) => event.preventDefault()} onKeyDown={handleMenuKeyDown} onClick={(event) => { if ((event.target as HTMLElement).closest("button")) setOpenMenu(null); }}>{menuItems}</div>, document.body) : null}
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
  const [localFonts, setLocalFonts] = useState<LocalFontFamilyRecord[]>(() => typeof window === "undefined" ? [] : loadStoredLocalFontFamilies());
  useEffect(() => {
    let active = true;
    void listCustomFonts().then(async (fonts) => {
      await Promise.allSettled(fonts.map(loadCustomFont));
      if (active) setCustomFonts(fonts);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const refresh = () => setLocalFonts(loadStoredLocalFontFamilies());
    window.addEventListener("storage", refresh);
    window.addEventListener("labnest:local-fonts-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("labnest:local-fonts-changed", refresh);
    };
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
    ...localFonts.map((font) => ({ value: `labnest-local-${font.id}`, label: font.name })),
  ];
  const paragraphLabel = paragraphType === "heading2" ? "Heading 2" : paragraphType === "heading3" ? "Heading 3" : "Body";
  const selectedFont = selectedFontFamily(editor);
  const fontLabel = selectedFont === "__mixed__" ? "Mixed fonts" : fontOptions.find((option) => option.value === selectedFont)?.label ?? "Times New Roman / 思源宋体";
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
    const id = `style-${globalThis.crypto?.randomUUID?.() ?? `${new Date().toISOString()}-${namedStyles.length}`}`;
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
    <ToolbarMenu id="style" label={paragraphLabel} ariaLabel="Paragraph style" openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu ln-wysiwyg-choice-menu" triggerClassName="ln-wysiwyg-style-select">
      <button type="button" data-active={paragraphType === "paragraph" || undefined} onClick={() => editor.chain().focus().setParagraph().run()}>Body</button>
      <button type="button" data-active={paragraphType === "heading2" || undefined} onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}>Heading 2</button>
      <button type="button" data-active={paragraphType === "heading3" || undefined} onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}>Heading 3</button>
      {namedStyles.map((style) => <button key={style.id} type="button" onClick={() => applyNamedStyle(style)}>{style.name}</button>)}
    </ToolbarMenu>
    <span className="ln-wysiwyg-toolbar-divider" aria-hidden />
    <ToolbarButton editor={editor} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden /></ToolbarButton>
    <ToolbarButton editor={editor} label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline aria-hidden /></ToolbarButton>
    <ToolbarMenu id="font" label={fontLabel} ariaLabel="Font" openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu ln-wysiwyg-font-menu" triggerClassName="ln-wysiwyg-font-select">
      <button type="button" data-active={!selectedFont || undefined} onClick={() => editor.chain().focus().unsetFontFamily().run()}>Document default</button>
      {fontOptions.map((option) => <button key={option.value} type="button" data-active={selectedFont === option.value || undefined} style={{ fontFamily: richTextFontFamilyCss(option.value) }} onClick={() => editor.chain().focus().setFontFamily(option.value).run()}>{option.label}</button>)}
    </ToolbarMenu>
    <ToolbarMenu id="size" label={textStyle.fontSize?.replace("pt", " pt") ?? "Size"} ariaLabel="Font size" openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu ln-wysiwyg-choice-menu" triggerClassName="ln-wysiwyg-size-select">
      <button type="button" data-active={!textStyle.fontSize || undefined} onClick={() => editor.chain().focus().unsetFontSize().run()}>Default</button>
      {RICH_TEXT_FONT_SIZES_PT.map((size) => <button key={size} type="button" data-active={textStyle.fontSize === `${size}pt` || undefined} onClick={() => editor.chain().focus().setFontSize(`${size}pt`).run()}>{size} pt</button>)}
    </ToolbarMenu>
    <ToolbarMenu id="spacing" label={`${textStyle.lineHeight ?? "1.6"}×`} ariaLabel="Line spacing" openMenu={openMenu} setOpenMenu={setOpenMenu} menuClassName="ln-wysiwyg-compact-menu ln-wysiwyg-choice-menu" triggerClassName="ln-wysiwyg-line-height-select">
      {RICH_TEXT_LINE_HEIGHTS.map((height) => <button key={height} type="button" data-active={String(textStyle.lineHeight ?? "1.6") === String(height) || undefined} onClick={() => editor.chain().focus().setLineHeight(String(height)).run()}>{height}×</button>)}
    </ToolbarMenu>
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

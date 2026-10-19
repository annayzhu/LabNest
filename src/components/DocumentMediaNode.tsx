"use client";

import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, Replace } from "lucide-react";
import { createDocumentWidgetExtension } from "@/lib/tiptap-document-extensions";
import { documentMediaUrl, type DocumentMedia } from "@/lib/document-media";
import { mediaDisplayWidth, mediaWidthPresets, snapMediaWidth, steppedMediaWidth } from "@/lib/document-media-resize";
import { DocumentMediaView } from "./DocumentMediaView";
import { ProtocolMediaImage } from "./ProtocolMediaImage";
import { chooseFiles, documentMediaDraftId, useMediaUpload } from "./DocumentMediaUploads";

/**
 * An image or file inside the document. The legend is written in place under the figure and the image is resized by
 * dragging its edge; both stay local while in motion and reach the document as one undoable change.
 */
function MediaNodeView({ node, updateAttributes, editor, selected, getPos }: NodeViewProps) {
  const block = node.attrs.block as DocumentMedia;
  // Read at the moment of writing: a legend saved after a pause must not undo a width chosen meanwhile.
  const currentBlock = (): DocumentMedia => { const pos = getPos(); return (typeof pos === "number" ? editor.state.doc.nodeAt(pos)?.attrs.block as DocumentMedia | undefined : undefined) ?? block; };
  const upload = useMediaUpload(block.id);
  const [focused, setFocused] = useState(false);
  const editorFocused = useEditorState({ editor, selector: ({ editor }) => editor.isFocused });
  const active = (selected && editorFocused) || focused;
  const image = block.mediaType === "image";
  const save = (patch: Partial<DocumentMedia>) => updateAttributes({ block: { ...currentBlock(), ...patch } });

  // Removing a media reference is one undoable action, even immediately after paste/upload.
  const deleteNode = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.chain().focus().command(({tr}) => { closeHistory(tr); return true; }).deleteRange({from:pos,to:pos+node.nodeSize}).run();
  };
  // Focus moves at once (Tiptap's own focus waits a frame), so the next keystroke never lands in the legend.
  const selectNode = () => { const pos = getPos(); if (typeof pos !== "number") return; editor.chain().setNodeSelection(pos).run(); editor.view.focus(); };
  /** Continue writing after the figure: into the next paragraph, or a new one. */
  const writeAfter = () => {
    const pos = getPos(); if (typeof pos !== "number") return;
    const after = pos + node.nodeSize, next = editor.state.doc.resolve(after).nodeAfter;
    if (next?.isTextblock) editor.chain().setTextSelection(after + 1).run();
    else editor.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).run();
    editor.view.focus();
  };

  // Resize: the figure follows the pointer locally; the width is written once when the edge is let go.
  const figureRef = useRef<HTMLElement>(null);
  const [resize, setResize] = useState<{ width: number; snapped: boolean } | null>(null);
  const width = resize?.width ?? block.widthPercent;
  const startResize = (event: React.PointerEvent<HTMLElement>) => {
    const figure = figureRef.current, column = figure?.parentElement;
    if (event.button !== 0 || !figure || !column) return;
    // No compatibility mousedown: the editor must not start a selection or a drag from the handle.
    event.preventDefault(); event.stopPropagation();
    const handle = event.currentTarget, pointer = event.pointerId, startX = event.clientX;
    const columnWidth = column.getBoundingClientRect().width, startWidth = figure.getBoundingClientRect().width;
    let latest = snapMediaWidth((startWidth / columnWidth) * 100, true);
    handle.setPointerCapture(pointer);
    setResize(latest);
    const moveTo = (moveEvent: PointerEvent) => { latest = snapMediaWidth(((startWidth + moveEvent.clientX - startX) / columnWidth) * 100, moveEvent.altKey); setResize(latest); };
    const finish = (commit: boolean) => {
      handle.removeEventListener("pointermove", moveTo); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", cancel);
      if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
      setResize(null);
      if (commit && latest.width !== currentBlock().widthPercent) save({ widthPercent: latest.width });
    };
    const up = () => finish(true), cancel = () => finish(false);
    handle.addEventListener("pointermove", moveTo); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", cancel);
  };
  const resizeByKey = (event: React.KeyboardEvent<HTMLElement>) => {
    const next = steppedMediaWidth(width ?? 100, event.key, event.shiftKey);
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation();
    if (next !== block.widthPercent) save({ widthPercent: next });
  };

  // Legend: typed locally (IME-safe), written to the document when the writer pauses, leaves or presses Enter.
  const [draft, setDraft] = useState<string | null>(null);
  const composing = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const caption = draft ?? block.caption ?? "";
  const commitCaption = (value: string | null) => {
    clearTimeout(idle.current);
    if (value === null || composing.current) return;
    const next = value.replace(/\s+$/, "");
    if (next !== (currentBlock().caption ?? "")) save({ caption: next || undefined });
  };
  const scheduleCaption = (value: string) => { clearTimeout(idle.current); idle.current = setTimeout(() => commitCaption(value), 700); };
  // A pending save must not reach a figure that was removed or an editor that closed.
  useEffect(() => { const timer = idle; return () => clearTimeout(timer.current); }, []);
  // Kept while the figure is selected even as focus leaves the editor for the field itself.
  const showCaption = Boolean(caption) || selected || focused;
  // The legend grows with its text and re-measures whenever the figure's width changes (load, resize, zoom).
  useLayoutEffect(() => {
    const field = captionRef.current;
    if (!field) return;
    let measuredWidth = -1;
    const fit = () => { if (field.clientWidth === measuredWidth) return; measuredWidth = field.clientWidth; field.style.height = "auto"; field.style.height = `${field.scrollHeight}px`; };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(field);
    return () => observer.disconnect();
  }, [caption, showCaption]);

  return <NodeViewWrapper data-document-media={block.id} data-widget-type="media" data-media-active={active} data-resizing={resize ? "" : undefined} className="document-media-node" contentEditable={false} tabIndex={0} role="group" aria-label="编辑附件 / Edit attachment"
    onClick={(event: React.MouseEvent) => { if (!(event.target as Element).closest("figcaption,button,a,[role=slider]")) selectNode(); }}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event: React.FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault(); event.stopPropagation(); deleteNode(); editor.commands.focus();
      } else if (event.key === "Enter") { event.preventDefault(); captionRef.current?.focus(); }
      else if (event.key === " ") { event.preventDefault(); selectNode(); }
    }}>

    <figure ref={figureRef} className="ln-media-figure" style={image ? { width: mediaDisplayWidth({ ...block, widthPercent: width }) } : undefined}>
      {image ? <div className="ln-media-frame">
        {upload?.preview ? <Image src={upload.preview} draggable={false} alt={block.filename || "图片预览 / Image preview"} unoptimized width={block.imageWidth ?? 1200} height={block.imageHeight ?? 800} style={{ aspectRatio:`${block.imageWidth ?? 1200} / ${block.imageHeight ?? 800}`, objectFit:"contain" }} onLoad={event=>{
          const preview=event.currentTarget;
          // Decode the local preview while upload is in flight. Completion keeps this
          // displayed ratio (including orientation) instead of changing it to a frame.
          if(preview.naturalWidth>0 && preview.naturalHeight>0 && (block.imageWidth!==preview.naturalWidth || block.imageHeight!==preview.naturalHeight))save({imageWidth:preview.naturalWidth,imageHeight:preview.naturalHeight});
        }} /> : !block.pendingUploadId && documentMediaUrl(block) ? <ProtocolMediaImage openOriginal={false} href={`${documentMediaUrl(block, true)!}${block.attachmentId ? "&preview=1" : ""}`} originalHref={documentMediaUrl(block, true)!} label={block.caption || block.filename || "图片 / Image"} imageWidth={block.imageWidth} imageHeight={block.imageHeight} /> : null}
        {upload?.status === "uploading" ? <span className="ln-media-progress" aria-hidden /> : null}
        <div data-print-hidden role="slider" tabIndex={active ? 0 : -1} aria-label="图片宽度 / Image width" aria-valuemin={10} aria-valuemax={100} aria-valuenow={Math.round(width ?? 100)} aria-valuetext={`${Math.round(width ?? 100)}%`} className="ln-media-handle" onPointerDown={startResize} onKeyDown={resizeByKey}><span /></div>
        {resize ? <span className="ln-media-readout" data-snapped={resize.snapped ? "" : undefined} aria-hidden>{resize.width}%</span> : null}
      </div> : !block.pendingUploadId ? <DocumentMediaView block={{ ...block, caption: undefined }} editing /> : null}
      {block.pendingUploadId ? <div role="status" className={upload?.preview && upload.status === "uploading" ? "ln-media-status is-overlay" : "ln-media-status"}>{block.filename} · {!upload ? "本地文件需重新选择，尚未保存 / Reselect the local file; not saved" : upload.status === "failed" ? "上传失败 / Upload failed" : "正在上传，尚未保存 / Uploading, not saved"}
        {upload?.status === "failed" ? <><p className="text-error">{upload.error}</p><button type="button" className="min-h-11 px-2 text-moss" onClick={upload.retry}>重试 / Retry</button></> : null}
        {!upload ? <button type="button" className="min-h-11 px-2 text-moss" onClick={() => chooseFiles(editor, documentMediaDraftId(editor), image ? "image/*" : "", block)}>重新选择文件 / Reselect file</button> : null}
      </div> : null}
      {showCaption ? <figcaption className="ln-media-caption" style={block.captionFontSizePt ? { fontSize: `${block.captionFontSizePt}pt` } : undefined} onMouseDown={event => { if (event.target !== captionRef.current) { event.preventDefault(); captionRef.current?.focus(); } }}>
        <textarea ref={captionRef} rows={1} value={caption} aria-label="图注 / Caption" placeholder={image ? "添加图注…" : "添加说明…"} spellCheck
          onFocus={() => setDraft(currentBlock().caption ?? "")}
          onChange={event => { setDraft(event.target.value); if (!composing.current) scheduleCaption(event.target.value); }}
          onCompositionStart={() => { composing.current = true; clearTimeout(idle.current); }}
          onCompositionEnd={event => { composing.current = false; scheduleCaption(event.currentTarget.value); }}
          onBlur={event => { composing.current = false; commitCaption(event.currentTarget.value); setDraft(null); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            const field = event.currentTarget, atEnd = field.selectionStart === field.value.length && field.selectionEnd === field.value.length;
            if ((event.key === "Enter" && !event.shiftKey) || (event.key === "ArrowDown" && atEnd)) { event.preventDefault(); commitCaption(field.value); setDraft(null); writeAfter(); }
            else if (event.key === "Escape" || (event.key === "ArrowUp" && field.selectionStart === 0 && field.selectionEnd === 0)) { event.preventDefault(); commitCaption(field.value); setDraft(null); selectNode(); }
          }} />
      </figcaption> : null}
    </figure>

    {/* Size, replace and the original; moving, copying and removing are the block's ⋮⋮. */}
    <div data-print-hidden className="document-media-toolbar" data-active={active} onPointerDownCapture={() => setFocused(true)} onClick={event => event.stopPropagation()}>
      {image ? <div className="document-media-sizes" role="group" aria-label="图片宽度 / Image width">{mediaWidthPresets.map(preset => <button key={preset.width} type="button" aria-pressed={Math.round(width ?? 100) === preset.width} title={`${preset.width}%`} onClick={() => save({ widthPercent: preset.width })}>{preset.label}</button>)}</div> : null}
      <span className="document-media-toolbar-rule" aria-hidden />
      {!block.pendingUploadId ? <button type="button" aria-label="替换附件 / Replace attachment" title="替换" onClick={() => chooseFiles(editor, documentMediaDraftId(editor), image ? "image/*" : "", block)}><Replace aria-hidden /></button> : null}
      {documentMediaUrl(block, true) ? <a href={documentMediaUrl(block, true)} target="_blank" rel="noreferrer" aria-label="查看原图 / Open original" title="查看原图"><ExternalLink aria-hidden /></a> : null}
    </div>
  </NodeViewWrapper>;
}

export const DocumentMediaNode = createDocumentWidgetExtension({ name: "documentMedia", htmlAttribute: "data-document-media", nodeView: ReactNodeViewRenderer(MediaNodeView) }).extend({
  addKeyboardShortcuts() {
    return {
      // With an image selected, Enter goes to its legend, the way a caption follows a figure.
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return false;
        const field = (editor.view.nodeDOM(selection.from) as HTMLElement | null)?.querySelector("textarea");
        if (!field) return false;
        field.focus();
        return true;
      },
    };
  },
});

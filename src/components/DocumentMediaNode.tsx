"use client";

import { ContextProperties } from "./ContextProperties";
import Image from "next/image";
import { useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import { GripVertical, Replace, Trash2 } from "lucide-react";
import { createDocumentWidgetExtension } from "@/lib/tiptap-document-extensions";
import { documentMediaUrl, type DocumentMedia } from "@/lib/document-media";
import { DocumentMediaView } from "./DocumentMediaView";
import { chooseFiles, documentMediaDraftId, useMediaUpload } from "./DocumentMediaUploads";

function MediaNodeView({ node, updateAttributes, deleteNode, editor, selected, getPos }: NodeViewProps) {
  const block = node.attrs.block as DocumentMedia;
  const upload = useMediaUpload(block.id);
  const [activation, setActivation] = useState(0);
  const [focused, setFocused] = useState(false);
  const editorFocused = useEditorState({ editor, selector: ({ editor }) => editor.isFocused });
  const active = (selected && editorFocused) || focused;
  const select = () => { setActivation(n => n + 1); const pos = getPos(); if (typeof pos === "number") editor.commands.setNodeSelection(pos); };
  return <NodeViewWrapper data-document-media={block.id} data-widget-type="media" data-media-active={active} className="document-media-node" contentEditable={false} tabIndex={0} role="group" aria-label="编辑附件 / Edit attachment"
    onClick={select} onFocusCapture={() => setFocused(true)} onBlurCapture={(event: React.FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); select(); } }}>

    {upload?.preview ? <Image src={upload.preview} alt={block.filename || "图片预览 / Image preview"} unoptimized width={1200} height={800} style={{ width: `${block.widthPercent ?? 100}%`, height: "auto", maxWidth: "100%" }} /> : !block.pendingUploadId ? <DocumentMediaView block={block} editing /> : null}
    {block.pendingUploadId ? <div role="status" className="py-2 text-sm text-muted">{block.filename} · {!upload ? "本地文件需重新选择，尚未保存 / Reselect the local file; not saved" : upload.status === "failed" ? "上传失败 / Upload failed" : "正在上传，尚未保存 / Uploading, not saved"}
      {upload?.status === "failed" ? <><p className="text-error">{upload.error}</p><button type="button" className="min-h-11 px-2 text-moss" onClick={upload.retry}>重试 / Retry</button></> : null}
      {!upload ? <button type="button" className="min-h-11 px-2 text-moss" onClick={() => chooseFiles(editor, documentMediaDraftId(editor), block.mediaType === "image" ? "image/*" : "", block)}>重新选择文件 / Reselect file</button> : null}
    </div> : null}
    <div data-print-hidden className="document-media-toolbar" data-active={active} onPointerDownCapture={() => setFocused(true)} onClick={event => event.stopPropagation()}>
      <button type="button" data-drag-handle aria-label="移动附件 / Move attachment" className="min-h-11 px-2"><GripVertical className="h-4 w-4" /></button>
      <ContextProperties title="图片属性 / Image properties" triggerLabel="图片设置 / Image settings" activation={activation} autoDismiss>
      <input aria-label="图注 / Caption" placeholder="图注 / Caption" className="min-h-9 min-w-0 flex-1 border-b border-hairline bg-transparent text-sm" value={block.caption || ""} onChange={event => updateAttributes({ block: { ...block, caption: event.target.value } })} />
      {block.mediaType === "image" ? <label className="inline-flex items-center gap-1">宽度 / Width <input aria-label="图片显示宽度百分比 / Image width percent" type="number" min={10} max={100} value={block.widthPercent ?? 100} className="w-16 min-h-9 border-b border-hairline bg-transparent" onChange={event => { const width = Number(event.target.value); if (width >= 10 && width <= 100) updateAttributes({ block: { ...block, widthPercent: width } }); }} />%</label> : null}
      <button type="button" aria-label="移除引用 / Remove reference" title="仅移除正文引用，保留原文件 / Keep original file" className="min-h-11 px-2 text-error" onClick={deleteNode}><Trash2 className="h-4 w-4" /></button>
      {!block.pendingUploadId ? <button type="button" aria-label="替换附件 / Replace attachment" className="min-h-11 px-2" onClick={() => chooseFiles(editor, documentMediaDraftId(editor), block.mediaType === "image" ? "image/*" : "", block)}><Replace className="h-4 w-4" /></button> : null}
      {documentMediaUrl(block, true) ? <a href={documentMediaUrl(block, true)} target="_blank" rel="noreferrer">查看原图 / Open original</a> : null}
      </ContextProperties>
    </div>
  </NodeViewWrapper>;
}

export const DocumentMediaNode = createDocumentWidgetExtension({ name: "documentMedia", htmlAttribute: "data-document-media", nodeView: ReactNodeViewRenderer(MediaNodeView) });

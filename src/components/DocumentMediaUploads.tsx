"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/core";
import { FilePlus2, ImagePlus } from "lucide-react";
import type { DocumentMedia } from "@/lib/document-media";
import type { WysiwygInsertAction } from "./DocumentWysiwygToolbar";

type Upload = { file: File; preview?: string; status: "uploading" | "failed"; error?: string; retry: () => void };
const uploads = new Map<string, Upload>();
const draftScopes = new WeakMap<Editor, string>();
export function documentMediaDraftId(editor: Editor) {
  let id = draftScopes.get(editor);
  if (!id) { id = crypto.randomUUID(); draftScopes.set(editor, id); }
  return id;
}
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
export function useMediaUpload(id: string) {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => uploads.get(id), () => undefined);
}

function updateAtIdentity(editor: Editor, id: string, block: DocumentMedia, completedUploadId?: string) {
  if (editor.isDestroyed) return;
  let match: { position: number; attrs: Record<string, unknown>; current: DocumentMedia } | undefined;
  editor.state.doc.descendants((node, position) => {
    if (node.attrs.block?.id === id) {
      match = { position, attrs: node.attrs, current: node.attrs.block as DocumentMedia };
      return false;
    }
  });
  if (!match || (completedUploadId && match.current.pendingUploadId !== completedUploadId)) return;
  // Finish only this upload; edits made while the request was in flight remain authoritative.
  const next = completedUploadId ? { ...block, caption: match.current.caption, widthPercent: match.current.widthPercent } : block;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(match.position, undefined, { ...match.attrs, block: next }));
}

/** Insert all anchors before starting I/O; completion never uses the current selection. */
export function insertDocumentMediaFiles(editor: Editor, files: File[], draftId: string, position?: number, replacement?: DocumentMedia) {
  const records = files.map(file => ({ file, block: {
    id: replacement?.id ?? crypto.randomUUID(), type: "media" as const,
    mediaType: file.type.startsWith("image/") ? "image" as const : file.type.startsWith("audio/") ? "audio" as const : file.type.startsWith("video/") ? "video" as const : "file" as const,
    url: "", filename: file.name, caption: replacement?.caption ?? "", mimeType: file.type, size: file.size,
    ...(replacement?.widthPercent ? { widthPercent: replacement.widthPercent } : {}),
    pendingUploadId: crypto.randomUUID(),
  } }));
  if (replacement && records[0]) updateAtIdentity(editor, replacement.id, records[0].block);
  else editor.chain().focus().insertContentAt(position ?? editor.state.selection.from, records.map(({ block }) => ({ type: "documentMedia", attrs: { block } }))).run();
  for (const { file, block } of records) {
    const preview = block.mediaType === "image" ? URL.createObjectURL(file) : undefined;
    const run = async () => {
      uploads.set(block.id, { file, preview, status: "uploading", retry: () => { void run(); } }); publish();
      try {
        const data = new FormData();
        data.set("file", file); data.set("targetType", "document_upload_draft"); data.set("targetId", draftId);
        data.set("linkType", "embedded_document_media"); data.set("clientMutationId", block.pendingUploadId);
        const response = await fetch("/api/attachments", { method: "POST", body: data });
        const result = await response.json();
        if (!response.ok || !result.attachment?.id) throw new Error(result.error || "Upload failed");
        const { pendingUploadId: _pending, ...ready } = block;
        void _pending;
        updateAtIdentity(editor, block.id, { ...ready, attachmentId: result.attachment.id }, block.pendingUploadId);
        uploads.delete(block.id); if (preview) URL.revokeObjectURL(preview); publish();
      } catch (error) {
        uploads.set(block.id, { file, preview, status: "failed", error: error instanceof Error ? error.message : "Upload failed", retry: () => { void run(); } }); publish();
      }
    };
    void run();
  }
}

function pendingInEditor(editor: Editor) {
  let pending = false;
  editor.state.doc.descendants(node => { if (node.attrs.block?.pendingUploadId) pending = true; });
  return pending;
}

export function useDocumentMediaUploads(editor: Editor | null, draftId: string) {
  useEffect(() => {
    if (!editor) return;
    draftScopes.set(editor, draftId);
    const dom = editor.view.dom;
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault(); event.stopPropagation();
      insertDocumentMediaFiles(editor, files, draftId);
    };
    const drop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault(); event.stopPropagation();
      const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
      insertDocumentMediaFiles(editor, files, draftId, position);
    };
    const submit = (event: Event) => {
      if (!pendingInEditor(editor)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      window.alert("图片或附件尚未上传完成，请重试或移除失败项后保存。 / Finish or retry uploads before saving.");
    };
    const form = dom.closest("form");
    dom.addEventListener("paste", paste, true); dom.addEventListener("drop", drop, true);
    form?.addEventListener("submit", submit, true);
    return () => { dom.removeEventListener("paste", paste, true); dom.removeEventListener("drop", drop, true); form?.removeEventListener("submit", submit, true); };
  }, [editor, draftId]);
}

export function documentMediaInsertActions(draftId: string): WysiwygInsertAction[] {
  return [{ id: "media", label: "图片 / Image", description: "选择照片、拖拽或粘贴截图 / Upload, drop or paste", icon: <ImagePlus aria-hidden />, run: editor => chooseFiles(editor, draftId, "image/*") },
    { id: "attachment", label: "附件 / File", description: "文件及音频 / Files and audio", icon: <FilePlus2 aria-hidden />, run: editor => chooseFiles(editor, draftId) }];
}

export function chooseFiles(editor: Editor, draftId: string, accept = "", replacement?: DocumentMedia) {
  const input = document.createElement("input"); input.type = "file"; input.multiple = !replacement; input.accept = accept;
  input.addEventListener("change", () => { const files = Array.from(input.files ?? []); if (files.length) insertDocumentMediaFiles(editor, files, draftId, undefined, replacement); }, { once: true });
  input.click();
}

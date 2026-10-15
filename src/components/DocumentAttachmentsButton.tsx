'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Download } from 'lucide-react';
import { collectDocumentMedia, documentMediaAttachmentId } from '@/lib/document-media';

/** 下载附件包 in the page header: every attachment this document shows, once all of them have uploaded. */
export function DocumentAttachmentsButton({ editor, hostId }: { editor: Editor; hostId: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setHost(document.getElementById(hostId)); });
    return () => { active = false; };
  }, [hostId]);
  const { ids, pending } = useEditorState({ editor, selector: ({ editor: current }) => {
    let media: ReturnType<typeof collectDocumentMedia> = [];
    try { media = collectDocumentMedia(current.getJSON()); } catch { /* An incomplete reference has nothing to download yet. */ }
    return { ids: [...new Set(media.flatMap(block => { const id = documentMediaAttachmentId(block); return id ? [id] : []; }))].join(','), pending: media.some(block => block.pendingUploadId) };
  } });
  if (!host || !ids) return null;
  return createPortal(<button type="button" className="focus-ring ln-document-action" disabled={pending} title={pending ? '附件仍在上传' : '下载本文中的全部附件'}
    onClick={() => window.location.assign(`/api/attachments/package?ids=${encodeURIComponent(ids)}`)}><Download aria-hidden />下载附件包</button>, host);
}

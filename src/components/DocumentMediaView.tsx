import { File, FileAudio, FileVideo } from "lucide-react";
import { ProtocolMediaImage } from "./ProtocolMediaImage";
import { documentMediaUrl, type DocumentMedia } from "@/lib/document-media";

/** Shared by editable previews, read-only documents and immutable Run snapshots. */
export function DocumentMediaView({ block, editing = false }: { block: DocumentMedia; editing?: boolean }) {
  const href = documentMediaUrl(block);
  const label = block.filename || block.caption || "附件 / Attachment";
  if (!href) return <p role="status" className="text-sm text-muted">附件尚未关联 / Attachment not linked</p>;
  if (block.mediaType === "image") return <figure className="ln-protocol-media-preview" style={{ width: `${block.widthPercent ?? 100}%`, maxWidth: "100%" }}>
    <ProtocolMediaImage openOriginal={!editing} href={`${documentMediaUrl(block, true)!}${block.attachmentId ? "&preview=1" : ""}`} originalHref={documentMediaUrl(block, true)!} label={block.caption || label} />
    {block.caption ? <figcaption>{block.caption}</figcaption> : null}
  </figure>;
  const Icon = block.mediaType === "audio" ? FileAudio : block.mediaType === "video" ? FileVideo : File;
  return <div className="py-1">
    <a href={href} className="inline-flex min-h-11 max-w-full items-center gap-2 text-sm text-moss underline-offset-2 hover:underline">
      <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="break-all">{label}</span>
      {block.size !== undefined ? <small className="shrink-0 text-muted">{Math.ceil(block.size / 1024)} KB</small> : null}
    </a>
    {block.caption && block.caption !== label ? <p className="text-sm text-muted">{block.caption}</p> : null}
  </div>;
}

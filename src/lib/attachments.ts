import path from "node:path";
import { MAX_ATTACHMENT_BYTES } from "./attachment-limits";

export function getAttachmentRoot() {
  const configured = process.env.LABNEST_ATTACHMENT_ROOT;

  if (configured && path.isAbsolute(configured)) {
    return configured;
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "attachments");
}

export function assertUploadSize(size: number) {
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment is larger than the 25 MB V1 upload limit.");
  }
}

export function safeAttachmentFilename(filename: string) {
  const parsed = path.parse(filename);
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const ext = parsed.ext.replace(/[^\w.]/g, "").slice(0, 16);

  return `${base || "attachment"}${ext}`;
}

export function resolveAttachmentPath(storagePath: string) {
  const root = getAttachmentRoot();
  const resolved = path.resolve(root, storagePath);

  if (!resolved.startsWith(root)) {
    throw new Error("Attachment path resolves outside the configured attachment root.");
  }

  return resolved;
}

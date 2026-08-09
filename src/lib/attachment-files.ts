import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_ENTRY_FILES, MAX_ENTRY_TOTAL_BYTES } from "@/lib/attachment-limits";
import { assertUploadSize, getAttachmentRoot, safeAttachmentFilename } from "@/lib/attachments";
import { buildAttachmentMetadata } from "@/lib/media-metadata";

export type PreparedAttachmentFile = {
  buffer: Buffer;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  absolutePath: string;
  sha256: string;
  metadataJson: ReturnType<typeof buildAttachmentMetadata>;
};

export function assertEntryFileSet(files: File[]) {
  if (files.length > MAX_ENTRY_FILES) {
    throw new Error(`An Entry can contain at most ${MAX_ENTRY_FILES} files.`);
  }

  let totalBytes = 0;
  files.forEach((file) => {
    if (!file.name || file.size === 0) throw new Error("Empty or unnamed files cannot be attached.");
    assertUploadSize(file.size);
    totalBytes += file.size;
  });

  if (totalBytes > MAX_ENTRY_TOTAL_BYTES) {
    throw new Error("Combined Entry attachments cannot exceed 100 MB.");
  }
}

export async function prepareAttachmentFile(file: File): Promise<PreparedAttachmentFile> {
  assertUploadSize(file.size);
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = safeAttachmentFilename(file.name);
  const now = new Date();
  const datePath = [String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0")];
  const filename = `${randomUUID()}-${safeName}`;
  const storagePath = path.join(...datePath, filename);

  return {
    buffer,
    filename,
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storagePath,
    absolutePath: path.join(getAttachmentRoot(), storagePath),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    metadataJson: buildAttachmentMetadata(buffer, file.type || "application/octet-stream"),
  };
}

export async function writePreparedAttachmentFiles(files: PreparedAttachmentFile[]) {
  await Promise.all(files.map(async (file) => {
    await mkdir(path.dirname(file.absolutePath), { recursive: true });
    await writeFile(file.absolutePath, file.buffer, { flag: "wx" });
  }));
}

export async function cleanupPreparedAttachmentFiles(files: PreparedAttachmentFile[]) {
  await Promise.allSettled(files.map((file) => unlink(file.absolutePath)));
}

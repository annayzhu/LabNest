import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveAttachmentPath } from "./attachments";
import { prisma } from "./db";
import { documentAttachmentIds, PROTOCOL_TRANSFER_MAX_BYTES, protocolTransferEnvelope, type ProtocolTransferMedia } from "./protocol-transfer";

/** The originals behind the pictures of these documents, read from this LabNest's own storage. */
async function transferMedia(records: Record<string, unknown>[]): Promise<ProtocolTransferMedia[]> {
  const name = (record?: Record<string, unknown>) => String(record?.humanCode ?? record?.canonicalTitle ?? "A Protocol");
  const idsOf = (record: Record<string, unknown>) => {
    try { return documentAttachmentIds(record.contentJson); }
    catch { throw new Error(`${name(record)} has a picture or attachment that cannot be read. Open it, remove or replace that item, then export again.`); }
  };
  const ids = [...new Set(records.flatMap(idsOf))];
  if (!ids.length) return [];
  const attachments = await prisma.attachment.findMany({ where: { id: { in: ids } }, select: { id: true, originalFilename: true, mimeType: true, storagePath: true, sha256: true } });
  const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  const media: ProtocolTransferMedia[] = [];
  for (const id of ids) {
    const attachment = byId.get(id);
    const bytes = attachment ? await readFile(resolveAttachmentPath(attachment.storagePath)).catch(() => undefined) : undefined;
    if (!attachment || !bytes) {
      throw new Error(`${name(records.find((record) => idsOf(record).includes(id)))} has a picture whose file is no longer stored. Remove or replace the picture, then export again.`);
    }
    media.push({ attachmentId: id, filename: attachment.originalFilename, mimeType: attachment.mimeType, sha256: attachment.sha256 ?? createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") });
  }
  return media;
}

/** The one file to hand to another LabNest: the exported records with their pictures inside. */
export async function protocolTransferFile(records: Record<string, unknown>[]): Promise<string> {
  const body = JSON.stringify(protocolTransferEnvelope(records, await transferMedia(records)), null, 2);
  if (Buffer.byteLength(body) > PROTOCOL_TRANSFER_MAX_BYTES) {
    throw new Error(records.length > 1
      ? "With their pictures these Protocols are larger than 25 MB, the most an import accepts. Export fewer at a time."
      : "With its pictures this Protocol is larger than 25 MB, the most an import accepts. Use smaller pictures, then export again.");
  }
  return body;
}

import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { resolveAttachmentPath } from "../src/lib/attachments";
import { buildAttachmentMetadata } from "../src/lib/media-metadata";

async function main() {
  const attachments = await prisma.attachment.findMany({
    where: { OR: [{ sha256: null }, { metadataJson: { equals: {} } }] },
    orderBy: { uploadedAt: "asc" },
  });
  let updated = 0;
  const missingFiles: string[] = [];

  for (const attachment of attachments) {
    try {
      const buffer = await readFile(resolveAttachmentPath(attachment.storagePath));
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          sha256: createHash("sha256").update(buffer).digest("hex"),
          metadataJson: buildAttachmentMetadata(buffer, attachment.mimeType),
        },
      });
      updated += 1;
    } catch {
      missingFiles.push(attachment.id);
    }
  }

  console.log(JSON.stringify({ scanned: attachments.length, updated, missingFiles }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

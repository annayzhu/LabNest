import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Prisma } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/db';
import { protocolDocumentSchema } from '../src/lib/protocol-document';
import { mergeRangePairs } from '../src/lib/protocol-range-merge';
import type { ProtocolSystems } from '../src/lib/protocol-systems-schema';

/**
 * Q130: draft Protocol versions whose source ranges were written as two chips get one range chip each. Reviewed or locked
 * versions and every experiment snapshot are left alone. Dry run by default; `--apply` writes, after saving the originals.
 */
const args = process.argv.slice(2), apply = args.includes('--apply');
const output = args.find(arg => arg.startsWith('--output='))?.slice(9) ?? '.local-runtime/protocol-range-merge';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function main() {
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const drafts = await prisma.protocolVersion.findMany({ where: { recordStatus: 'draft', reviewStage: { not: 'reviewed' } }, select: { id: true, protocolId: true, displayVersion: true, title: true, contentJson: true, protocol: { select: { humanCode: true } } } });
  const changes = drafts.flatMap(version => {
    const content = version.contentJson as { systems?: ProtocolSystems; sections?: unknown };
    if (!content?.systems || !Array.isArray(content.sections)) return [];
    const { document, merged } = mergeRangePairs(content as { systems: ProtocolSystems; sections: unknown });
    if (!merged.length) return [];
    protocolDocumentSchema.parse(document);
    return [{ version, document, merged }];
  });
  const report = changes.map(({ version, merged }) => ({ versionId: version.id, protocol: version.protocol.humanCode, title: version.title, displayVersion: version.displayVersion, merged }));
  writeFileSync(`${output}/original.json`, JSON.stringify(changes.map(({ version }) => ({ id: version.id, contentJson: version.contentJson })), null, 2), { mode: 0o600 });
  writeFileSync(`${output}/report.json`, JSON.stringify({ apply, drafts: drafts.length, changed: report.length, originalHash: hash(changes.map(({ version }) => version.contentJson)), report }, null, 2));
  console.log(JSON.stringify({ apply, drafts: drafts.length, changed: report.length, ranges: report.reduce((sum, item) => sum + item.merged.length, 0), output }));
  if (!apply) return;
  await prisma.$transaction(async tx => {
    for (const { version, document, merged } of changes) {
      const current = await tx.protocolVersion.findUniqueOrThrow({ where: { id: version.id }, select: { contentJson: true, recordStatus: true, reviewStage: true } });
      if (current.recordStatus !== 'draft' || current.reviewStage === 'reviewed' || hash(current.contentJson) !== hash(version.contentJson)) throw new Error(`${version.id} changed since the dry run; run again.`);
      await tx.protocolVersion.update({ where: { id: version.id }, data: { contentJson: document as Prisma.InputJsonValue } });
      await tx.activityLog.create({ data: { action: 'merge_protocol_ranges', targetType: 'protocol_version', targetId: version.id, metadataJson: { merged } } });
    }
  });
}
main().finally(() => prisma.$disconnect());

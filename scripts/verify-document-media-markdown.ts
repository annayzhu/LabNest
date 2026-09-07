import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { buildStructuredExport } from "../src/lib/structured-export";
import { parseStructuredFile } from "../src/lib/structured-files";
import { collectDocumentMedia } from "../src/lib/document-media";

async function main() {
  assert(process.env.DATABASE_URL?.includes("/labnest_media63_acceptance"));
  const plans = await prisma.researchPlan.findMany({ where: { projectId: "media63-project" }, orderBy: { createdAt: "desc" } });
  const plan = plans.find(plan => collectDocumentMedia(plan.contentJson).length); assert(plan);
  const expected = collectDocumentMedia(plan.contentJson)[0];
  const exported = await buildStructuredExport("research-plans", "md", { scope: "selected", ids: [plan.id] });
  const parsed = await parseStructuredFile(new File([exported.body], exported.filename), "research-plans");
  assert(collectDocumentMedia(parsed.records).some(media => media.attachmentId === expected.attachmentId), "Markdown export and reimport retain the image attachment identity");
  console.log("PASS research-plan Markdown export/reimport retains managed media");
}
void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

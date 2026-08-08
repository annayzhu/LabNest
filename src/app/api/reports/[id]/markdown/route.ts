import { prisma } from "@/lib/db";
import { normalizeScientificDocument, reportSections, type ScientificContentBlock } from "@/lib/scientific-document";

function blockMarkdown(block: ScientificContentBlock) {
  if (block.type === "heading") return `### ${block.text}`;
  if (block.type === "text") return block.text;
  if (block.type === "checklist") return block.items.map((item) => `- ${item}`).join("\n");
  if (block.type === "table") return [block.caption ? `**${block.caption}**` : "", block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")].filter(Boolean).join("\n\n");
  if (block.type === "callout") return `> ${block.tone.toUpperCase()}: ${block.text}`;
  if (block.type === "metric") return `**${block.label}:** ${block.value} ${block.unit ?? ""}`.trim();
  if (block.type === "media") return `[${block.caption || block.mediaType}](${block.url})`;
  return `Dataset: ${block.label} (${block.datasetId})`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = await prisma.report.findUnique({ where: { id }, include: { project: true, researchPlan: true, sources: { orderBy: { order: "asc" } } } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  const document = normalizeScientificDocument(report.contentJson, reportSections);
  const body = [
    `# ${report.title}`,
    `Project: ${report.project.name}`,
    report.researchPlan ? `Research Plan: ${report.researchPlan.code ?? report.researchPlan.title}` : "Scope: Entire Project",
    `Status: ${report.status}`,
    ...document.sections.flatMap((section) => [`## ${section.title}`, ...section.blocks.map(blockMarkdown)]),
    "## Source index",
    ...report.sources.map((source) => `- ${source.sourceType}: ${source.titleSnapshot}${source.versionSnapshot ? ` (${source.versionSnapshot})` : ""}${source.hrefSnapshot ? ` — ${source.hrefSnapshot}` : ""}`),
  ].filter(Boolean).join("\n\n");
  const filename = `${report.title.replace(/[^\p{L}\p{N}.-]+/gu, "-").replace(/^-|-$/g, "") || "report"}.md`;
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } });
}

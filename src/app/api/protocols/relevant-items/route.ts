import { prisma } from "@/lib/db";
import type { RelevantCatalogItem, RelevantCatalogType } from "@/lib/protocol-relevant-items";

export const runtime = "nodejs";

const searchableTypes = new Set<RelevantCatalogType>(["research_plan", "project", "experiment", "result", "attachment"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 120);
  const requestedType = params.get("type") ?? "all";
  const type = requestedType === "all" || searchableTypes.has(requestedType as RelevantCatalogType)
    ? requestedType as RelevantCatalogType | "all"
    : "all";
  const projectId = (params.get("projectId") ?? "").trim() || undefined;
  const includes = (candidate: RelevantCatalogType) => type === "all" || type === candidate;
  const take = 30;

  const [plans, projects, experiments, results, attachments] = await Promise.all([
    includes("research_plan") ? prisma.researchPlan.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        OR: [{ title: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }],
      },
      include: { project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    }) : [],
    includes("project") ? prisma.project.findMany({ where: { name: { contains: query, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, name: true } }) : [],
    includes("experiment") ? prisma.experiment.findMany({ where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { runCode: { contains: query, mode: "insensitive" } }] }, orderBy: { updatedAt: "desc" }, take, select: { id: true, runCode: true, title: true, status: true } }) : [],
    includes("result") ? prisma.result.findMany({ where: { title: { contains: query, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, title: true, recordStatus: true } }) : [],
    includes("attachment") ? prisma.attachment.findMany({ where: { originalFilename: { contains: query, mode: "insensitive" } }, orderBy: { uploadedAt: "desc" }, take, select: { id: true, originalFilename: true, mimeType: true, size: true } }) : [],
  ]);

  const items: RelevantCatalogItem[] = [
    ...plans.map((plan) => ({ id: plan.id, type: "research_plan" as const, label: `${plan.code ? `${plan.code} · ` : ""}${plan.title}`, meta: plan.project.name, projectId: plan.projectId, projectName: plan.project.name })),
    ...projects.map((project) => ({ id: project.id, type: "project" as const, label: project.name, href: `/projects/${project.id}` })),
    ...experiments.map((experiment) => ({ id: experiment.id, type: "experiment" as const, label: `${experiment.runCode} · ${experiment.title}`, meta: experiment.status, href: `/experiments/${experiment.id}` })),
    ...results.map((result) => ({ id: result.id, type: "result" as const, label: result.title, meta: result.recordStatus, href: `/results/${result.id}` })),
    ...attachments.map((attachment) => ({ id: attachment.id, type: "attachment" as const, label: attachment.originalFilename, meta: `${attachment.mimeType} · ${Math.max(1, Math.round(attachment.size / 1024))} KB`, href: `/api/attachments/${attachment.id}` })),
  ];
  return Response.json({ items: items.slice(0, take) });
}

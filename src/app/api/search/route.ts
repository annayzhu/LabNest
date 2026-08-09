import { prisma } from "@/lib/db";
import type { ItemType } from "@/lib/types";

export const runtime = "nodejs";

type DatabaseSearchResult = {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  href: string;
  matchedText?: string;
};

function textFilter(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function response(results: DatabaseSearchResult[], query: string) {
  return Response.json({
    query,
    count: results.length,
    results,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  if (!query) {
    return response([], query);
  }

  const [
    entries,
    researchPlans,
    experiments,
    protocols,
    entities,
    sampleProfiles,
    inventoryItems,
    results,
    reports,
    purchases,
    procurementQuoteLines,
    sequences,
  ] = await Promise.all([
    prisma.entry.findMany({
      where: { OR: [{ title: textFilter(query) }, { body: textFilter(query) }, { moodStatus: textFilter(query) }] },
      take: limit,
      orderBy: { occurredAt: "desc" },
      include: { project: true },
    }),
    prisma.researchPlan.findMany({
      where: { OR: [{ code: textFilter(query) }, { title: textFilter(query) }, { objective: textFilter(query) }, { hypothesis: textFilter(query) }, { rationale: textFilter(query) }, { design: textFilter(query) }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { project: true },
    }),
    prisma.experiment.findMany({
      where: {
        OR: [
          { title: textFilter(query) },
          { runCode: textFilter(query) },
          { purpose: textFilter(query) },
          { searchText: textFilter(query) },
        ],
      },
      take: limit,
      orderBy: { date: "desc" },
      include: { project: true },
    }),
    prisma.protocol.findMany({
      where: { OR: [{ title: textFilter(query) }, { description: textFilter(query) }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.entity.findMany({
      where: { OR: [{ name: textFilter(query) }, { code: textFilter(query) }, { description: textFilter(query) }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { project: true },
    }),
    prisma.sampleProfile.findMany({
      where: {
        OR: [
          { sampleCode: textFilter(query) },
          { sampleType: textFilter(query) },
          { sourceLabel: textFilter(query) },
          { sourceType: textFilter(query) },
          { notes: textFilter(query) },
          { entity: { name: textFilter(query) } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { entity: true },
    }),
    prisma.inventoryItem.findMany({
      where: {
        OR: [
          { name: textFilter(query) },
          { englishName: textFilter(query) },
          { category: textFilter(query) },
          { brand: textFilter(query) },
          { barcode: textFilter(query) },
          { aliquotCode: textFilter(query) },
          { lotNumber: textFilter(query) },
          { vendor: textFilter(query) },
          { catalogNumber: textFilter(query) },
          { casNumber: textFilter(query) },
          { storageCondition: textFilter(query) },
          { notes: textFilter(query) },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { location: true },
    }),
    prisma.result.findMany({
      where: { OR: [{ title: textFilter(query) }, { resultType: textFilter(query) }, { templateKey: textFilter(query) }, { textValue: textFilter(query) }, { notes: textFilter(query) }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, entity: true, project: true },
    }),
    prisma.report.findMany({
      where: { title: textFilter(query) },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { project: true, researchPlan: true },
    }),
    prisma.purchaseRequest.findMany({
      where: {
        OR: [
          { title: textFilter(query) },
          { vendor: textFilter(query) },
          { catalogNumber: textFilter(query) },
          { lotNumber: textFilter(query) },
          { notes: textFilter(query) },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.procurementQuoteLine.findMany({
      where: {
        OR: [
          { supplierName: textFilter(query) },
          { productCategory: textFilter(query) },
          { productName: textFilter(query) },
          { casNumber: textFilter(query) },
          { specification: textFilter(query) },
          { brand: textFilter(query) },
          { catalogNumber: textFilter(query) },
          { decisionReason: textFilter(query) },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sequence.findMany({
      where: { OR: [{ name: textFilter(query) }, { sequence: textFilter(query) }, { description: textFilter(query) }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const merged: DatabaseSearchResult[] = [
    ...entries.map((entry) => ({
      id: entry.id,
      type: "entry" as const,
      title: entry.title,
      subtitle: entry.project?.name,
      href: `/entries/${entry.id}`,
      matchedText: entry.body,
    })),
    ...experiments.map((experiment) => ({
      id: experiment.id,
      type: "experiment" as const,
      title: experiment.title,
      subtitle: experiment.project?.name,
      href: `/experiments/${experiment.id}`,
      matchedText: experiment.purpose ?? experiment.searchText ?? undefined,
    })),
    ...researchPlans.map((plan) => ({
      id: plan.id,
      type: "research_plan" as const,
      title: plan.title,
      subtitle: `${plan.project.name} · ${plan.code ?? plan.status}`,
      href: `/research-plans/${plan.id}`,
      matchedText: plan.objective ?? plan.hypothesis ?? undefined,
    })),
    ...protocols.map((protocol) => ({
      id: protocol.id,
      type: "protocol" as const,
      title: protocol.title,
      subtitle: protocol.availability,
      href: `/protocols/${protocol.id}`,
      matchedText: protocol.description ?? undefined,
    })),
    ...entities.map((entity) => ({
      id: entity.id,
      type: "entity" as const,
      title: entity.name,
      subtitle: entity.code ?? entity.type,
      href: `/entities?type=${entity.type}`,
      matchedText: entity.description ?? undefined,
    })),
    ...sampleProfiles.map((sample) => ({
      id: sample.id,
      type: "sample_profile" as const,
      title: sample.entity.name,
      subtitle: sample.sampleCode,
      href: `/samples?status=${sample.status}`,
      matchedText: sample.notes ?? sample.sourceLabel ?? undefined,
    })),
    ...inventoryItems.map((item) => ({
      id: item.id,
      type: "inventory_item" as const,
      title: item.name,
      subtitle: item.englishName ?? item.brand ?? item.aliquotCode ?? item.lotNumber ?? item.location?.name,
      href: `/inventory/${item.id}`,
      matchedText: item.casNumber ?? item.catalogNumber ?? item.notes ?? item.storageCondition ?? undefined,
    })),
    ...results.map((result) => ({
      id: result.id,
      type: "result" as const,
      title: result.title,
      subtitle: result.experiment?.title ?? result.resultType,
      href: `/results/${result.id}`,
      matchedText: result.notes ?? result.textValue ?? undefined,
    })),
    ...reports.map((report) => ({
      id: report.id,
      type: "report" as const,
      title: report.title,
      subtitle: `${report.project.name} · ${report.researchPlan?.code ?? "Project scope"}`,
      href: `/reports/${report.id}`,
      matchedText: report.status,
    })),
    ...purchases.map((purchase) => ({
      id: purchase.id,
      type: "purchase" as const,
      title: purchase.title,
      subtitle: purchase.vendor ?? purchase.status,
      href: `/purchases?status=${purchase.status}`,
      matchedText: purchase.notes ?? purchase.catalogNumber ?? undefined,
    })),
    ...procurementQuoteLines.map((line) => ({
      id: line.id,
      type: "procurement_quote_line" as const,
      title: line.productName,
      subtitle: line.supplierName ?? line.status,
      href: `/purchases?quote=${line.id}`,
      matchedText: line.decisionReason ?? line.catalogNumber ?? undefined,
    })),
    ...sequences.map((sequence) => ({
      id: sequence.id,
      type: "sequence" as const,
      title: sequence.name,
      subtitle: sequence.type,
      href: `/sequences?type=${sequence.type}`,
      matchedText: sequence.description ?? undefined,
    })),
  ];

  return response(merged.slice(0, limit), query);
}

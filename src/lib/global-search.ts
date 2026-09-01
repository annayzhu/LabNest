import { prisma } from "@/lib/db";
import { labToolManifest } from "@/lib/tool-manifest";
import type { ItemType } from "@/lib/types";

export type GlobalSearchResult = {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  location: string;
  href: string;
  matchedText?: string;
};

function textFilter(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function exactTagFilter(query: string) {
  return { has: query };
}

function compactText(value: string | null | undefined, query: string, maxLength = 220) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.length <= maxLength) return text;

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, index > -1 ? index - 55 : 0);
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function firstMatch(query: string, values: Array<string | null | undefined>) {
  const normalized = query.toLowerCase();
  const match = values.find((value) => value?.toLowerCase().includes(normalized));
  return compactText(match, query);
}

function typeRank(type: ItemType) {
  const rank: Partial<Record<ItemType, number>> = {
    project: 0,
    research_plan: 1,
    experiment: 2,
    protocol: 3,
    protocol_version: 4,
    result: 5,
    report: 6,
    entry: 7,
    inventory_item: 8,
    sample_profile: 9,
    sequence: 10,
    tool: 11,
  };
  return rank[type] ?? 99;
}

function matchRank(result: GlobalSearchResult, query: string) {
  const normalized = query.toLowerCase();
  const title = result.title.toLowerCase();
  const subtitle = result.subtitle?.toLowerCase() ?? "";
  if (title === normalized) return 0;
  if (title.startsWith(normalized)) return 1;
  if (title.includes(normalized)) return 2;
  if (subtitle.includes(normalized)) return 3;
  return 4;
}

function rankResults(results: GlobalSearchResult[], query: string) {
  return [...results].sort((a, b) => {
    const byMatch = matchRank(a, query) - matchRank(b, query);
    if (byMatch) return byMatch;
    const byType = typeRank(a.type) - typeRank(b.type);
    if (byType) return byType;
    return a.title.localeCompare(b.title);
  });
}

function searchTools(query: string): GlobalSearchResult[] {
  const normalized = query.toLowerCase();
  return labToolManifest
    .filter((tool) => [tool.name, tool.category, tool.description, tool.version, ...tool.accepts, ...tool.produces].some((value) => value.toLowerCase().includes(normalized)))
    .map((tool) => ({
      id: tool.id,
      type: "tool" as const,
      title: tool.name,
      subtitle: `${tool.category} · v${tool.version}`,
      location: `Tools / ${tool.category}`,
      href: tool.launchUrl ?? "/tools",
      matchedText: firstMatch(query, [tool.description, ...tool.accepts, ...tool.produces]),
    }));
}

export async function searchLabNestRecords(query: string, limit = 50): Promise<GlobalSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const perSourceLimit = Math.max(10, safeLimit);

  try {
    const recycled = await prisma.deletedRecord.findMany({
      where: { restoredAt: null },
      select: { targetType: true, targetId: true },
    });
    const recycledIds = (targetType: string) => recycled.filter((row) => row.targetType === targetType).map((row) => row.targetId);

    const [
      projects,
      researchPlans,
      experiments,
      protocols,
      protocolVersions,
      entries,
      entities,
      sampleProfiles,
      sampleEvents,
      inventoryItems,
      results,
      reports,
      purchases,
      procurementInquiries,
      procurementQuoteLines,
      sequences,
      sequencePairs,
      attachments,
      referenceConnectors,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          id: { notIn: recycledIds("project") },
          OR: [
            { name: textFilter(normalizedQuery) },
            { description: textFilter(normalizedQuery) },
            { keyInformation: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.researchPlan.findMany({
        where: {
          id: { notIn: recycledIds("research_plan") },
          OR: [
            { code: textFilter(normalizedQuery) },
            { title: textFilter(normalizedQuery) },
            { objective: textFilter(normalizedQuery) },
            { hypothesis: textFilter(normalizedQuery) },
            { rationale: textFilter(normalizedQuery) },
            { keyInformation: textFilter(normalizedQuery) },
            { design: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { project: true },
      }),
      prisma.experiment.findMany({
        where: {
          id: { notIn: recycledIds("experiment") },
          OR: [
            { title: textFilter(normalizedQuery) },
            { runCode: textFilter(normalizedQuery) },
            { purpose: textFilter(normalizedQuery) },
            { searchText: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
            { researchPlan: { title: textFilter(normalizedQuery) } },
            { researchPlan: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { date: "desc" },
        include: { project: true, researchPlan: true },
      }),
      prisma.protocol.findMany({
        where: {
          id: { notIn: recycledIds("protocol") },
          OR: [
            { humanCode: textFilter(normalizedQuery) },
            { title: textFilter(normalizedQuery) },
            { canonicalTitle: textFilter(normalizedQuery) },
            { shortTitle: textFilter(normalizedQuery) },
            { englishTitle: textFilter(normalizedQuery) },
            { description: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { project: true },
      }),
      prisma.protocolVersion.findMany({
        where: {
          OR: [
            { title: textFilter(normalizedQuery) },
            { displayVersion: textFilter(normalizedQuery) },
            { purpose: textFilter(normalizedQuery) },
            { background: textFilter(normalizedQuery) },
            { scope: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { changeSummary: textFilter(normalizedQuery) },
            { sourceFileName: textFilter(normalizedQuery) },
            { protocol: { humanCode: textFilter(normalizedQuery) } },
            { protocol: { title: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { createdAt: "desc" },
        include: { protocol: true },
      }),
      prisma.entry.findMany({
        where: {
          id: { notIn: recycledIds("entry") },
          OR: [
            { title: textFilter(normalizedQuery) },
            { body: textFilter(normalizedQuery) },
            { moodStatus: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
            { researchPlan: { title: textFilter(normalizedQuery) } },
            { researchPlan: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { occurredAt: "desc" },
        include: { project: true, researchPlan: true },
      }),
      prisma.entity.findMany({
        where: {
          OR: [
            { name: textFilter(normalizedQuery) },
            { code: textFilter(normalizedQuery) },
            { description: textFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { project: true },
      }),
      prisma.sampleProfile.findMany({
        where: {
          OR: [
            { sampleCode: textFilter(normalizedQuery) },
            { sampleType: textFilter(normalizedQuery) },
            { sourceLabel: textFilter(normalizedQuery) },
            { sourceType: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { entity: { name: textFilter(normalizedQuery) } },
            { entity: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { entity: true },
      }),
      prisma.sampleLifecycleEvent.findMany({
        where: {
          OR: [
            { title: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { sampleProfile: { sampleCode: textFilter(normalizedQuery) } },
            { sampleProfile: { entity: { name: textFilter(normalizedQuery) } } },
            { experiment: { title: textFilter(normalizedQuery) } },
            { experiment: { runCode: textFilter(normalizedQuery) } },
            { inventoryItem: { name: textFilter(normalizedQuery) } },
            { inventoryItem: { aliquotCode: textFilter(normalizedQuery) } },
            { fromLocation: { name: textFilter(normalizedQuery) } },
            { toLocation: { name: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { occurredAt: "desc" },
        include: { sampleProfile: { include: { entity: true } }, experiment: true, inventoryItem: true, fromLocation: true, toLocation: true },
      }),
      prisma.inventoryItem.findMany({
        where: {
          id: { notIn: recycledIds("inventory_item") },
          OR: [
            { name: textFilter(normalizedQuery) },
            { englishName: textFilter(normalizedQuery) },
            { category: textFilter(normalizedQuery) },
            { brand: textFilter(normalizedQuery) },
            { principalInvestigator: textFilter(normalizedQuery) },
            { barcode: textFilter(normalizedQuery) },
            { aliquotCode: textFilter(normalizedQuery) },
            { lotNumber: textFilter(normalizedQuery) },
            { vendor: textFilter(normalizedQuery) },
            { catalogNumber: textFilter(normalizedQuery) },
            { casNumber: textFilter(normalizedQuery) },
            { containerType: textFilter(normalizedQuery) },
            { concentration: textFilter(normalizedQuery) },
            { storageCondition: textFilter(normalizedQuery) },
            { positionCode: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { location: { name: textFilter(normalizedQuery) } },
            { entity: { name: textFilter(normalizedQuery) } },
            { entity: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { location: true, entity: true },
      }),
      prisma.result.findMany({
        where: {
          id: { notIn: recycledIds("result") },
          OR: [
            { title: textFilter(normalizedQuery) },
            { resultType: textFilter(normalizedQuery) },
            { templateKey: textFilter(normalizedQuery) },
            { templateInstanceKey: textFilter(normalizedQuery) },
            { templateInstanceLabel: textFilter(normalizedQuery) },
            { textValue: textFilter(normalizedQuery) },
            { analysisMethod: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { experiment: { title: textFilter(normalizedQuery) } },
            { experiment: { runCode: textFilter(normalizedQuery) } },
            { entity: { name: textFilter(normalizedQuery) } },
            { project: { name: textFilter(normalizedQuery) } },
            { researchPlan: { title: textFilter(normalizedQuery) } },
            { researchPlan: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { experiment: true, entity: true, project: true, researchPlan: true },
      }),
      prisma.report.findMany({
        where: {
          id: { notIn: recycledIds("report") },
          OR: [
            { title: textFilter(normalizedQuery) },
            { tags: exactTagFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
            { researchPlan: { title: textFilter(normalizedQuery) } },
            { researchPlan: { code: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { project: true, researchPlan: true },
      }),
      prisma.purchaseRequest.findMany({
        where: {
          OR: [
            { title: textFilter(normalizedQuery) },
            { vendor: textFilter(normalizedQuery) },
            { catalogNumber: textFilter(normalizedQuery) },
            { lotNumber: textFilter(normalizedQuery) },
            { storageCondition: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.procurementInquiry.findMany({
        where: {
          OR: [
            { title: textFilter(normalizedQuery) },
            { importedFileName: textFilter(normalizedQuery) },
            { supplierScope: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { project: true },
      }),
      prisma.procurementQuoteLine.findMany({
        where: {
          OR: [
            { supplierName: textFilter(normalizedQuery) },
            { productCategory: textFilter(normalizedQuery) },
            { productName: textFilter(normalizedQuery) },
            { casNumber: textFilter(normalizedQuery) },
            { specification: textFilter(normalizedQuery) },
            { brand: textFilter(normalizedQuery) },
            { catalogNumber: textFilter(normalizedQuery) },
            { decisionReason: textFilter(normalizedQuery) },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
        include: { inquiry: true },
      }),
      prisma.sequence.findMany({
        where: {
          pairMembership: { is: null },
          OR: [
            { code: textFilter(normalizedQuery) },
            { name: textFilter(normalizedQuery) },
            { targetName: textFilter(normalizedQuery) },
            { organism: textFilter(normalizedQuery) },
            { description: textFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
            { versions: { some: { sequence: textFilter(normalizedQuery) } } },
            { versions: { some: { validationSummary: textFilter(normalizedQuery) } } },
          ],
        },
        include: { project: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.sequencePair.findMany({
        where: {
          OR: [
            { code: textFilter(normalizedQuery) },
            { name: textFilter(normalizedQuery) },
            { targetName: textFilter(normalizedQuery) },
            { organism: textFilter(normalizedQuery) },
            { description: textFilter(normalizedQuery) },
            { project: { name: textFilter(normalizedQuery) } },
            { members: { some: { sequenceVersion: { sequence: textFilter(normalizedQuery) } } } },
            { members: { some: { sequenceVersion: { validationSummary: textFilter(normalizedQuery) } } } },
          ],
        },
        include: { project: true, members: { include: { sequenceVersion: true }, orderBy: { order: "asc" } } },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attachment.findMany({
        where: {
          OR: [
            { filename: textFilter(normalizedQuery) },
            { originalFilename: textFilter(normalizedQuery) },
            { mimeType: textFilter(normalizedQuery) },
            { sha256: textFilter(normalizedQuery) },
          ],
        },
        take: perSourceLimit,
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.referenceConnector.findMany({
        where: {
          OR: [
            { displayName: textFilter(normalizedQuery) },
            { libraryScope: textFilter(normalizedQuery) },
            { baseUrl: textFilter(normalizedQuery) },
            { notes: textFilter(normalizedQuery) },
          ],
        },
        take: perSourceLimit,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const merged: GlobalSearchResult[] = [
      ...projects.map((project) => ({
        id: project.id,
        type: "project" as const,
        title: project.name,
        subtitle: project.status,
        location: "Projects",
        href: `/projects/${project.id}`,
        matchedText: firstMatch(normalizedQuery, [project.description, project.keyInformation, ...project.tags]),
      })),
      ...researchPlans.map((plan) => ({
        id: plan.id,
        type: "research_plan" as const,
        title: plan.title,
        subtitle: plan.code,
        location: `Projects / ${plan.project.name} / Research Plans`,
        href: `/research-plans/${plan.id}`,
        matchedText: firstMatch(normalizedQuery, [plan.objective, plan.hypothesis, plan.rationale, plan.keyInformation, plan.design, ...plan.tags]),
      })),
      ...experiments.map((experiment) => ({
        id: experiment.id,
        type: "experiment" as const,
        title: experiment.title,
        subtitle: experiment.runCode,
        location: `${experiment.project?.name ? `Projects / ${experiment.project.name} / ` : ""}${experiment.researchPlan?.code ? `Research Plans / ${experiment.researchPlan.code} / ` : ""}Experiments`,
        href: `/experiments/${experiment.id}`,
        matchedText: firstMatch(normalizedQuery, [experiment.purpose, experiment.searchText, ...experiment.tags]),
      })),
      ...protocols.map((protocol) => ({
        id: protocol.id,
        type: "protocol" as const,
        title: protocol.title,
        subtitle: protocol.humanCode,
        location: `${protocol.project?.name ? `Projects / ${protocol.project.name} / ` : ""}Protocols`,
        href: `/protocols/${protocol.id}`,
        matchedText: firstMatch(normalizedQuery, [protocol.description, protocol.canonicalTitle, protocol.shortTitle, protocol.englishTitle, ...protocol.tags]),
      })),
      ...protocolVersions.map((version) => ({
        id: version.id,
        type: "protocol_version" as const,
        title: version.title,
        subtitle: `${version.protocol.humanCode} · v${version.displayVersion}`,
        location: `Protocols / ${version.protocol.humanCode} / Versions`,
        href: `/protocols/${version.protocolId}`,
        matchedText: firstMatch(normalizedQuery, [version.purpose, version.background, version.scope, version.notes, version.changeSummary, version.sourceFileName]),
      })),
      ...entries.map((entry) => ({
        id: entry.id,
        type: "entry" as const,
        title: entry.title,
        subtitle: entry.project?.name ?? entry.researchPlan?.code ?? entry.recordStatus,
        location: `${entry.project?.name ? `Projects / ${entry.project.name} / ` : ""}${entry.researchPlan?.code ? `Research Plans / ${entry.researchPlan.code} / ` : ""}Entries`,
        href: `/entries/${entry.id}`,
        matchedText: firstMatch(normalizedQuery, [entry.body, entry.moodStatus, ...entry.tags]),
      })),
      ...entities.map((entity) => ({
        id: entity.id,
        type: "entity" as const,
        title: entity.name,
        subtitle: entity.code ?? entity.type,
        location: `${entity.project?.name ? `Projects / ${entity.project.name} / ` : ""}Samples / Objects`,
        href: `/entities?type=${entity.type}`,
        matchedText: compactText(entity.description, normalizedQuery),
      })),
      ...sampleProfiles.map((sample) => ({
        id: sample.id,
        type: "sample_profile" as const,
        title: sample.entity.name,
        subtitle: sample.sampleCode,
        location: "Samples / Sample profiles",
        href: `/samples?status=${sample.status}`,
        matchedText: firstMatch(normalizedQuery, [sample.sampleType, sample.sourceLabel, sample.sourceType, sample.notes]),
      })),
      ...sampleEvents.map((event) => ({
        id: event.id,
        type: "sample_lifecycle_event" as const,
        title: event.title,
        subtitle: `${event.sampleProfile.sampleCode} · ${event.type}`,
        location: `Samples / ${event.sampleProfile.entity.name} / Lifecycle`,
        href: `/samples?eventType=${event.type}`,
        matchedText: firstMatch(normalizedQuery, [event.notes, event.experiment?.title, event.inventoryItem?.name, event.fromLocation?.name, event.toLocation?.name]),
      })),
      ...inventoryItems.map((item) => ({
        id: item.id,
        type: "inventory_item" as const,
        title: item.name,
        subtitle: item.aliquotCode ?? item.lotNumber ?? item.location?.name ?? item.status,
        location: `Inventory${item.location?.name ? ` / ${item.location.name}` : ""}`,
        href: `/inventory/${item.id}`,
        matchedText: firstMatch(normalizedQuery, [item.englishName, item.category, item.brand, item.principalInvestigator, item.barcode, item.vendor, item.catalogNumber, item.casNumber, item.storageCondition, item.positionCode, item.notes, item.entity?.name]),
      })),
      ...results.map((result) => ({
        id: result.id,
        type: "result" as const,
        title: result.title,
        subtitle: result.experiment?.title ?? result.resultType,
        location: `${result.project?.name ? `Projects / ${result.project.name} / ` : ""}${result.researchPlan?.code ? `Research Plans / ${result.researchPlan.code} / ` : ""}Results`,
        href: `/results/${result.id}`,
        matchedText: firstMatch(normalizedQuery, [result.textValue, result.notes, result.analysisMethod, result.templateKey, result.templateInstanceLabel, result.entity?.name]),
      })),
      ...reports.map((report) => ({
        id: report.id,
        type: "report" as const,
        title: report.title,
        subtitle: report.status,
        location: `Projects / ${report.project.name}${report.researchPlan?.code ? ` / Research Plans / ${report.researchPlan.code}` : ""} / Reports`,
        href: `/reports/${report.id}`,
        matchedText: firstMatch(normalizedQuery, [report.status, ...report.tags]),
      })),
      ...purchases.map((purchase) => ({
        id: purchase.id,
        type: "purchase" as const,
        title: purchase.title,
        subtitle: purchase.vendor ?? purchase.status,
        location: "Purchases",
        href: `/purchases?status=${purchase.status}`,
        matchedText: firstMatch(normalizedQuery, [purchase.vendor, purchase.catalogNumber, purchase.lotNumber, purchase.storageCondition, purchase.notes]),
      })),
      ...procurementInquiries.map((inquiry) => ({
        id: inquiry.id,
        type: "procurement_inquiry" as const,
        title: inquiry.title,
        subtitle: inquiry.importedFileName ?? inquiry.status,
        location: `${inquiry.project?.name ? `Projects / ${inquiry.project.name} / ` : ""}Purchases / Inquiries`,
        href: `/purchases?inquiry=${inquiry.id}`,
        matchedText: firstMatch(normalizedQuery, [inquiry.importedFileName, inquiry.supplierScope, inquiry.notes]),
      })),
      ...procurementQuoteLines.map((line) => ({
        id: line.id,
        type: "procurement_quote_line" as const,
        title: line.productName,
        subtitle: line.supplierName ?? line.status,
        location: `Purchases / ${line.inquiry.title} / Quotes`,
        href: `/purchases?quote=${line.id}`,
        matchedText: firstMatch(normalizedQuery, [line.supplierName, line.productCategory, line.casNumber, line.specification, line.brand, line.catalogNumber, line.decisionReason]),
      })),
      ...sequences.map((sequence) => ({
        id: sequence.id,
        type: "sequence" as const,
        title: sequence.name,
        subtitle: `${sequence.code} · ${sequence.designType} · v${sequence.versions[0]?.displayVersion ?? "?"}`,
        location: `${sequence.project?.name ? `Projects / ${sequence.project.name} / ` : ""}Sequences`,
        href: `/sequences/${sequence.id}`,
        matchedText: firstMatch(normalizedQuery, [sequence.targetName, sequence.organism, sequence.description, sequence.versions[0]?.validationSummary, sequence.versions[0]?.sequence]),
      })),
      ...sequencePairs.map((pair) => ({
        id: pair.id,
        type: "sequence" as const,
        title: pair.name,
        subtitle: `${pair.code} · ${pair.type.replaceAll("_", " ")} · 2 members`,
        location: `${pair.project?.name ? `Projects / ${pair.project.name} / ` : ""}Sequences`,
        href: `/sequences/pairs/${pair.id}`,
        matchedText: firstMatch(normalizedQuery, [pair.targetName, pair.organism, pair.description, ...pair.members.flatMap((member) => [member.sequenceVersion.validationSummary, member.sequenceVersion.sequence])]),
      })),
      ...attachments.map((attachment) => ({
        id: attachment.id,
        type: "attachment" as const,
        title: attachment.originalFilename,
        subtitle: attachment.mimeType,
        location: "Attachments",
        href: "/attachments",
        matchedText: firstMatch(normalizedQuery, [attachment.filename, attachment.sha256]),
      })),
      ...referenceConnectors.map((connector) => ({
        id: connector.id,
        type: "reference_connector" as const,
        title: connector.displayName,
        subtitle: connector.provider,
        location: "Settings / References",
        href: "/settings",
        matchedText: firstMatch(normalizedQuery, [connector.libraryScope, connector.baseUrl, connector.notes]),
      })),
      ...searchTools(normalizedQuery),
    ];

    return rankResults(merged, normalizedQuery).slice(0, safeLimit);
  } catch {
    return rankResults(searchTools(normalizedQuery), normalizedQuery).slice(0, safeLimit);
  }
}

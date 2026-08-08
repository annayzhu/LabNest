import {
  entries,
  experiments,
  inventoryItems,
  procurementInquiries,
  procurementQuoteLines,
  projects,
  protocols,
  purchases,
  referenceConnectors,
  results,
  sampleLifecycleEvents,
  sampleProfiles,
  sequences,
  entities,
} from "./demo-data";
import type { ItemType } from "./types";

export type SearchResult = {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  href: string;
  matchedText?: string;
};

type SearchSource = SearchResult & {
  keywords: (string | number | undefined | null)[];
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function textMatch(query: string, values: (string | number | undefined | null)[]) {
  const normalized = normalizeQuery(query);

  if (!normalized) return true;

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function firstMatch(query: string, values: (string | number | undefined | null)[]) {
  const normalized = normalizeQuery(query);
  const value = values.find((item) => String(item ?? "").toLowerCase().includes(normalized));

  return value === undefined || value === null ? undefined : String(value);
}

function searchableSources(): SearchSource[] {
  return [
    ...entries.map((entry) => ({
      id: entry.id,
      type: "entry" as const,
      title: entry.title,
      subtitle: entry.projectName,
      href: `/entries?tag=${encodeURIComponent(entry.tags[0] ?? "")}`,
      keywords: [entry.title, entry.body, entry.projectName, ...entry.tags],
    })),
    ...experiments.map((experiment) => ({
      id: experiment.id,
      type: "experiment" as const,
      title: experiment.title,
      subtitle: experiment.projectName,
      href: `/experiments?status=${experiment.status}`,
      keywords: [
        experiment.title,
        experiment.purpose,
        experiment.background,
        experiment.materialsText,
        experiment.observations,
        experiment.projectName,
        ...experiment.tags,
      ],
    })),
    ...protocols.map((protocol) => ({
      id: protocol.id,
      type: "protocol" as const,
      title: protocol.title,
      subtitle: protocol.currentVersion.title,
      href: `/protocols?availability=${protocol.availability}`,
      keywords: [protocol.title, protocol.description, protocol.currentVersion.changeSummary, ...protocol.tags],
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "project" as const,
      title: project.name,
      subtitle: project.status,
      href: `/projects?status=${project.status}`,
      keywords: [project.name, project.description, ...project.tags],
    })),
    ...entities.map((entity) => ({
      id: entity.id,
      type: "entity" as const,
      title: entity.name,
      subtitle: entity.code ?? entity.type,
      href: `/entities?type=${entity.type}`,
      keywords: [entity.name, entity.code, entity.type, entity.description, entity.projectName],
    })),
    ...sampleProfiles.map((sample) => ({
      id: sample.id,
      type: "sample_profile" as const,
      title: sample.name,
      subtitle: sample.sampleCode,
      href: `/samples?status=${sample.status}`,
      keywords: [
        sample.name,
        sample.sampleCode,
        sample.sampleType,
        sample.sourceLabel,
        sample.projectName,
        sample.primaryLocation,
        sample.notes,
      ],
    })),
    ...sampleLifecycleEvents.map((event) => ({
      id: event.id,
      type: "sample_lifecycle_event" as const,
      title: event.title,
      subtitle: event.type,
      href: `/samples?eventType=${event.type}`,
      keywords: [
        event.title,
        event.type,
        event.experimentTitle,
        event.aliquotCode,
        event.fromLocation,
        event.toLocation,
        event.notes,
      ],
    })),
    ...inventoryItems.map((item) => ({
      id: item.id,
      type: "inventory_item" as const,
      title: item.name,
      subtitle: item.lotNumber ?? item.location,
      href: `/inventory?status=${item.status}`,
      keywords: [
        item.name,
        item.barcode,
        item.aliquotCode,
        item.lotNumber,
        item.vendor,
        item.catalogNumber,
        item.location,
        item.storageCondition,
        item.notes,
      ],
    })),
    ...results.map((result) => ({
      id: result.id,
      type: "result" as const,
      title: result.title,
      subtitle: result.experimentTitle ?? result.resultType,
      href: `/results?type=${result.resultType}`,
      keywords: [
        result.title,
        result.resultType,
        result.experimentTitle,
        result.entityName,
        result.projectName,
        result.textValue,
        result.notes,
      ],
    })),
    ...purchases.map((purchase) => ({
      id: purchase.id,
      type: "purchase" as const,
      title: purchase.title,
      subtitle: purchase.vendor ?? purchase.status,
      href: `/purchases?status=${purchase.status}`,
      keywords: [purchase.title, purchase.vendor, purchase.catalogNumber, purchase.status, purchase.notes],
    })),
    ...procurementInquiries.map((inquiry) => ({
      id: inquiry.id,
      type: "procurement_inquiry" as const,
      title: inquiry.title,
      subtitle: inquiry.importedFileName ?? inquiry.status,
      href: `/purchases?inquiry=${inquiry.id}`,
      keywords: [
        inquiry.title,
        inquiry.importedFileName,
        inquiry.supplierScope,
        inquiry.status,
        inquiry.projectName,
        inquiry.notes,
      ],
    })),
    ...procurementQuoteLines.map((line) => ({
      id: line.id,
      type: "procurement_quote_line" as const,
      title: line.productName,
      subtitle: line.supplierName ?? line.status,
      href: `/purchases?quote=${line.id}`,
      keywords: [
        line.productName,
        line.supplierName,
        line.productCategory,
        line.casNumber,
        line.specification,
        line.brand,
        line.catalogNumber,
        line.decisionReason,
      ],
    })),
    ...sequences.map((sequence) => ({
      id: sequence.id,
      type: "sequence" as const,
      title: sequence.name,
      subtitle: sequence.linkedEntity ?? sequence.type,
      href: `/sequences?type=${sequence.type}`,
      keywords: [sequence.name, sequence.type, sequence.sequence, sequence.description, sequence.linkedEntity],
    })),
    ...referenceConnectors.map((connector) => ({
      id: connector.id,
      type: "reference_connector" as const,
      title: connector.displayName,
      subtitle: connector.provider,
      href: "/settings",
      keywords: [
        connector.displayName,
        connector.provider,
        connector.libraryScope,
        connector.baseUrl,
        connector.notes,
      ],
    })),
  ];
}

export function searchDemoRecords(query: string, limit = 50): SearchResult[] {
  return searchableSources()
    .filter((source) => textMatch(query, [source.title, source.subtitle, ...source.keywords]))
    .map(({ keywords, ...source }) => ({
      ...source,
      matchedText: firstMatch(query, keywords),
    }))
    .slice(0, limit);
}

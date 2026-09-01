export const userManagedRelevantTypes = ["project", "experiment", "result", "attachment"] as const;
export type UserManagedRelevantType = (typeof userManagedRelevantTypes)[number];
export type RelevantCatalogType = UserManagedRelevantType | "research_plan" | "version";

export type RelevantCatalogItem = {
  id: string;
  type: RelevantCatalogType;
  label: string;
  meta?: string;
  href?: string;
  projectId?: string;
  projectName?: string;
};

export type ManualRelevantLink = { type: UserManagedRelevantType; id: string };

export function buildProtocolRelevantCatalog({
  projects = [], experiments = [], results = [], attachments = [],
}: {
  projects?: { id: string; name: string }[];
  experiments?: { id: string; runCode: string; title: string; status: string }[];
  results?: { id: string; title: string; recordStatus: string }[];
  attachments?: { id: string; originalFilename: string; mimeType: string; size: number }[];
}): RelevantCatalogItem[] {
  return [
    ...projects.map((project) => ({ id: project.id, type: "project" as const, label: project.name, href: `/projects/${project.id}` })),
    ...experiments.map((experiment) => ({ id: experiment.id, type: "experiment" as const, label: `${experiment.runCode} · ${experiment.title}`, meta: experiment.status, href: `/experiments/${experiment.id}` })),
    ...results.map((result) => ({ id: result.id, type: "result" as const, label: result.title, meta: result.recordStatus, href: `/results/${result.id}` })),
    ...attachments.map((attachment) => ({ id: attachment.id, type: "attachment" as const, label: attachment.originalFilename, meta: `${attachment.mimeType} · ${Math.max(1, Math.round(attachment.size / 1024))} KB`, href: `/api/attachments/${attachment.id}` })),
  ];
}

export function filterRelevantItemCatalog(
  catalog: RelevantCatalogItem[],
  query: string,
  type: RelevantCatalogType | "all",
  limit = 30,
) {
  const needle = query.trim().toLocaleLowerCase();
  return catalog
    .filter((item) => type === "all" || item.type === type)
    .filter((item) => !needle || `${item.label} ${item.meta ?? ""}`.toLocaleLowerCase().includes(needle))
    .slice(0, limit);
}

export function normalizeManualRelevantLinks(value: unknown): ManualRelevantLink[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(userManagedRelevantTypes);
  const unique = new Map<string, ManualRelevantLink>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const type = "type" in candidate ? String(candidate.type) : "";
    const id = "id" in candidate ? String(candidate.id).trim() : "";
    if (!allowed.has(type) || !id) continue;
    unique.set(`${type}:${id}`, { type: type as UserManagedRelevantType, id });
  }
  return [...unique.values()];
}

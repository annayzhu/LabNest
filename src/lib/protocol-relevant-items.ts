export const userManagedRelevantTypes = ["project", "experiment", "result", "attachment"] as const;
export type UserManagedRelevantType = (typeof userManagedRelevantTypes)[number];
export type RelevantCatalogType = UserManagedRelevantType | "research_plan" | "version";

export type RelevantCatalogItem = {
  id: string;
  type: RelevantCatalogType;
  label: string;
  meta?: string;
  href?: string;
};

export type ManualRelevantLink = { type: UserManagedRelevantType; id: string };

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

import { format } from "date-fns";
import type { Entry } from "@/lib/types";

export type EntryMonthGroup = {
  key: string;
  label: string;
  entries: Entry[];
};

export type EntryProjectCollection = {
  id: string;
  name: string;
  count: number;
};

export function groupEntriesByMonth(entries: Entry[]): EntryMonthGroup[] {
  const groups = new Map<string, EntryMonthGroup>();

  entries.forEach((entry) => {
    const occurredAt = new Date(entry.occurredAt);
    const key = format(occurredAt, "yyyy-MM");
    const existing = groups.get(key);

    if (existing) {
      existing.entries.push(entry);
      return;
    }

    groups.set(key, {
      key,
      label: format(occurredAt, "MMMM yyyy"),
      entries: [entry],
    });
  });

  return Array.from(groups.values());
}

export function summarizeProjectCollections(entries: Entry[]): EntryProjectCollection[] {
  const collections = new Map<string, EntryProjectCollection>();

  entries.forEach((entry) => {
    if (!entry.projectId || !entry.projectName) return;

    const existing = collections.get(entry.projectId);
    if (existing) {
      existing.count += 1;
      return;
    }

    collections.set(entry.projectId, {
      id: entry.projectId,
      name: entry.projectName,
      count: 1,
    });
  });

  return Array.from(collections.values()).sort((left, right) => left.name.localeCompare(right.name));
}

import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { AppLocale } from "@/lib/i18n";
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

function dateLocale(locale: AppLocale) {
  return locale === "zh" ? zhCN : enUS;
}

export function formatEntryCardTimestamp(value: string | Date, locale: AppLocale) {
  const date = new Date(value);
  return locale === "zh"
    ? format(date, "M月d日 EEEE · HH:mm", { locale: dateLocale(locale) })
    : format(date, "EEEE, MMM d · HH:mm", { locale: dateLocale(locale) });
}

export function formatEntryDetailTimestamp(value: string | Date, locale: AppLocale) {
  const date = new Date(value);
  return locale === "zh"
    ? format(date, "yyyy年M月d日 EEEE · HH:mm", { locale: dateLocale(locale) })
    : format(date, "EEEE, MMMM d, yyyy · HH:mm", { locale: dateLocale(locale) });
}

export function groupEntriesByMonth(entries: Entry[], locale: AppLocale = "en"): EntryMonthGroup[] {
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
      label: locale === "zh"
        ? format(occurredAt, "yyyy年M月", { locale: dateLocale(locale) })
        : format(occurredAt, "MMMM yyyy", { locale: dateLocale(locale) }),
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

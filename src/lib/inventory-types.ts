import { zhUi } from "./i18n";

/** The five lifecycle 大类: fixed keys, renamed or hidden in InventoryGroup, never added or removed. */
export const inventoryGroupKeys = ["reagent", "consumable", "biological", "sample", "equipment"] as const;
export type InventoryGroupKey = (typeof inventoryGroupKeys)[number];

export const inventoryGroupNames: Record<InventoryGroupKey, string> = {
  reagent: "Reagents & chemicals",
  consumable: "Consumables",
  biological: "Biological materials",
  sample: "Samples",
  equipment: "Instruments & equipment",
};

export function isInventoryGroupKey(value: unknown): value is InventoryGroupKey {
  return typeof value === "string" && (inventoryGroupKeys as readonly string[]).includes(value);
}

/** A group's name as people see it: their own label, else the built-in one. */
export function inventoryGroupName(group: { key: string; label?: string | null }) {
  return group.label?.trim() || (isInventoryGroupKey(group.key) ? inventoryGroupNames[group.key] : group.key);
}

type TypeRef = { key: string; label: string; inventoryGroupKey: string | null };
export type InventoryClass = { groupKey: InventoryGroupKey | null; typeKey: string | null };

/** Categories stock had before types, as 大类 and type. */
const legacyCategories: Record<string, { groupKey: InventoryGroupKey; typeKey: string | null }> = {
  reagent: { groupKey: "reagent", typeKey: null },
  consumable: { groupKey: "consumable", typeKey: null },
  antibody: { groupKey: "reagent", typeKey: "antibody" },
  kit: { groupKey: "reagent", typeKey: "kit" },
  chemical: { groupKey: "reagent", typeKey: "chemical" },
  instrument_accessory: { groupKey: "equipment", typeKey: "accessory" },
};

const fold = (text: string) => text.trim().toLowerCase();

/**
 * An old category value, or a category column in an import file, as 大类 and type. Anything not recognised,
 * including biological_sample and other, stays unclassified (待归类) for a person to decide.
 */
export function inventoryClassFromCategory(category: string | null | undefined, types: readonly TypeRef[]): InventoryClass {
  const text = fold(category ?? "");
  if (!text) return { groupKey: null, typeKey: null };
  const legacy = legacyCategories[text];
  if (legacy) return legacy;
  const names = (label: string) => [label, zhUi[label] ?? ""].map(fold);
  const type = types.find((candidate) => fold(candidate.key) === text || names(candidate.label).includes(text));
  if (type) return { groupKey: isInventoryGroupKey(type.inventoryGroupKey) ? type.inventoryGroupKey : null, typeKey: type.key };
  const groupKey = inventoryGroupKeys.find((key) => key === text || names(inventoryGroupNames[key]).includes(text));
  return { groupKey: groupKey ?? null, typeKey: null };
}

export type InventoryFieldKind = "text" | "number" | "date" | "choice";
export type InventoryTypeField = { key: string; label: string; kind: InventoryFieldKind; options?: string[] };
const fieldKinds: readonly string[] = ["text", "number", "date", "choice"];

/** A type's field template from its stored JSON; malformed entries are dropped, a missing kind is text. */
export function inventoryTypeFields(value: unknown): InventoryTypeField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { key, label, kind, options } = entry as Record<string, unknown>;
    if (typeof key !== "string" || !key.trim() || typeof label !== "string" || !label.trim()) return [];
    const fieldKind = (typeof kind === "string" && fieldKinds.includes(kind) ? kind : "text") as InventoryFieldKind;
    const choices = fieldKind === "choice" && Array.isArray(options) ? options.filter((option): option is string => typeof option === "string" && !!option.trim()) : undefined;
    return [{ key, label, kind: fieldKind, ...(choices ? { options: choices } : {}) }];
  });
}

export type InventoryManagementMode = "information" | "package" | "precise";
export type InventoryTypeDefaults = { managementMode: InventoryManagementMode; unit: string; tracksLot: boolean; tracksExpiry: boolean };

/** What a type sets up for new stock, from defaultSettings.inventory. */
export function inventoryTypeDefaults(settings: unknown): InventoryTypeDefaults {
  const stored = settings && typeof settings === "object" ? (settings as { inventory?: Record<string, unknown> }).inventory ?? {} : {};
  const mode = stored.managementMode;
  return {
    managementMode: mode === "package" || mode === "precise" ? mode : "information",
    unit: typeof stored.unit === "string" ? stored.unit : "",
    tracksLot: stored.tracksLot !== false,
    tracksExpiry: stored.tracksExpiry !== false,
  };
}

const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
const sharesStem = (a: string, b: string) => {
  let common = 0;
  while (common < a.length && a[common] === b[common]) common += 1;
  return common >= Math.min(5, a.length, b.length);
};

/**
 * Existing types a new one may duplicate — a name containing or contained in the other (English or Chinese),
 * a shared word stem ("antibodies" / "antibody"), or two or more field labels in common.
 */
export function similarInventoryTypes<T extends { label: string; fields: { label: string }[] }>(candidate: { label: string; fields: string[] }, existing: readonly T[]) {
  const name = fold(candidate.label);
  const candidateFields = new Set(candidate.fields.map(fold).filter(Boolean));
  return existing.filter((type) => {
    const names = [type.label, zhUi[type.label] ?? ""].map(fold).filter((label) => label.length >= 2);
    const byName = name.length >= 2 && names.some((label) => label.includes(name) || name.includes(label));
    const byStem = words(candidate.label).some((word) => words(type.label).some((other) => sharesStem(word, other)));
    const sharedFields = type.fields.filter((field) => candidateFields.has(fold(field.label))).length;
    return byName || byStem || sharedFields >= 2;
  });
}

import { convert, normalizeUnit, units } from "./calculators/quantities";
import { zhUi } from "./i18n";
import { inventoryTypeFields, type InventoryTypeField } from "./inventory-types";

/** One save holds at most this many samples (S8). */
export const MAX_SAMPLE_BATCH = 500;

export const sampleStatuses = ["available", "depleted", "discarded", "sent_out"] as const;
export type SampleStatusValue = (typeof sampleStatuses)[number];
export const sampleStatusLabels: Record<SampleStatusValue, string> = { available: "In storage", depleted: "Used up", discarded: "Discarded", sent_out: "Sent out" };
export const isSampleStatus = (value: unknown): value is SampleStatusValue => typeof value === "string" && (sampleStatuses as readonly string[]).includes(value);
export const biosafetyLevels = ["BSL-1", "BSL-2", "BSL-3"] as const;

/** A sample type's defaults for new samples, from defaultSettings.sample. */
export function sampleTypeDefaults(settings: unknown) {
  const stored = settings && typeof settings === "object" ? (settings as { sample?: Record<string, unknown> }).sample ?? {} : {};
  return {
    amountUnit: typeof stored.amountUnit === "string" ? stored.amountUnit : "",
    concentrationUnit: typeof stored.concentrationUnit === "string" ? stored.concentrationUnit : "",
  };
}

const slug = (label: string) => label.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** A type's fields as edited: keys stay as they are (samples store values under them); a new field gets one from its name. */
export function keyedSampleFields(raw: unknown): InventoryTypeField[] {
  const entries = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  const fields = inventoryTypeFields(entries.map((entry, index) => {
    const field = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const label = typeof field.label === "string" ? field.label.trim() : "";
    let key = typeof field.key === "string" && field.key.trim() ? field.key.trim() : slug(label) || `field_${index + 1}`;
    while (used.has(key)) key = `${key}_${index + 1}`;
    used.add(key);
    return { ...field, key, label };
  }));
  if (fields.length !== entries.length) throw new Error("Every field needs a name.");
  if (fields.some((field) => field.kind === "choice" && !field.options?.length)) throw new Error("A choice field needs at least one option.");
  return fields;
}
export const sampleTypeKeyBase = (label: string) => `sample_${slug(label) || "type"}`;

export type SampleTypeRef = { id: string; key: string; label: string; prefix: string | null; fields: InventoryTypeField[]; amountUnit: string; concentrationUnit: string };
export const sampleTypeRef = (type: { id: string; key: string; label: string; prefix: string | null; fieldDefinitions: unknown; defaultSettings: unknown }): SampleTypeRef =>
  ({ id: type.id, key: type.key, label: type.label, prefix: type.prefix, fields: inventoryTypeFields(type.fieldDefinitions), ...sampleTypeDefaults(type.defaultSettings) });

/** The type a written name means: its key (with or without sample_), its name in English or as the Chinese interface shows it, or its prefix. */
export function sampleTypeNamed<T extends SampleTypeRef>(types: T[], text: string) {
  const wanted = matchKey(text);
  return types.find((type) => [type.key, type.key.replace(/^sample_/, ""), type.label, zhUi[type.label] ?? "", type.prefix ?? ""].some((name) => name && matchKey(name) === wanted));
}

// Codes: the type's prefix, a hyphen and a running number (RNA-0001).

/** A prefix as codes use it: letters, digits and hyphens, upper case; SMP when nothing is left. */
export function samplePrefix(text: string | null | undefined) {
  const cleaned = (text ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9-]+/g, "").replace(/^-+|-+$/g, "");
  return cleaned || "SMP";
}
export const sampleCode = (prefix: string, value: number, width = 4) => `${prefix}-${String(value).padStart(width, "0")}`;
/** The running number of a code made from this prefix, e.g. 12 for RNA-0012; undefined for any other code. */
export function sampleCodeNumber(prefix: string, code: string) {
  const match = code.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`));
  const value = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(value) ? value : undefined;
}
/** Names numbered by a rule: P2026-001-T, P2026-002-T… */
export function nameSeries({ prefix, start, width, count, suffix = "" }: { prefix: string; start: number; width: number; count: number; suffix?: string }) {
  return Array.from({ length: count }, (_, index) => `${prefix}${String(start + index).padStart(width, "0")}${suffix}`);
}
/** Codes and names compare without case, width or surrounding space: RNA-0001 and rna-0001 are the same sample. */
export const matchKey = (text: string) => text.normalize("NFKC").trim().toUpperCase();

// Positions: A1 is row A, column 1. Rows run A–Z.

export type BoxGeometry = { rows: number; columns: number };
export const MAX_BOX_ROWS = 26;
export const MAX_BOX_COLUMNS = 48;
export const boxGeometry = (location: { gridRows: number | null; gridColumns: number | null } | null | undefined): BoxGeometry | null =>
  location?.gridRows && location.gridColumns ? { rows: location.gridRows, columns: location.gridColumns } : null;
export const rowLabel = (index: number) => String.fromCharCode(65 + index);

export function parsePosition(text: string) {
  const match = text.normalize("NFKC").trim().toUpperCase().match(/^([A-Z])\s*-?\s*0*(\d{1,2})$/);
  if (!match) return null;
  return { row: match[1].charCodeAt(0) - 65, column: Number(match[2]) - 1 };
}
export const positionLabel = (row: number, column: number) => `${rowLabel(row)}${column + 1}`;

/** "a01" reads as A1; text that is not a grid position stays as typed (a shelf slot, "第3格"). */
export function normalizePosition(text: string | null | undefined) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  const parsed = parsePosition(trimmed);
  return parsed && parsed.column >= 0 ? positionLabel(parsed.row, parsed.column) : trimmed;
}

/** Why a position does not fit its box; undefined when it does. Without a grid any text is a position. */
export function positionProblem(position: string, geometry: BoxGeometry | null) {
  if (!geometry) return undefined;
  const parsed = parsePosition(position);
  if (!parsed || parsed.column < 0) return `${position} is not a position like A1.`;
  if (parsed.row >= geometry.rows || parsed.column >= geometry.columns) return `${position} is outside the ${geometry.rows} × ${geometry.columns} box.`;
  return undefined;
}

/** Every position of a box, row by row: A1, A2 … B1. */
export function boxPositions(geometry: BoxGeometry) {
  return Array.from({ length: geometry.rows * geometry.columns }, (_, index) => positionLabel(Math.floor(index / geometry.columns), index % geometry.columns));
}

/** Free positions from `start` on, row by row, skipping occupied ones. */
export function freePositions(geometry: BoxGeometry, occupied: Iterable<string>, start?: string) {
  const taken = new Set([...occupied].map(normalizePosition));
  const all = boxPositions(geometry);
  const from = start ? Math.max(0, all.indexOf(normalizePosition(start))) : 0;
  return all.slice(from).filter((position) => !taken.has(position));
}

export function comparePositions(a: string, b: string) {
  const left = parsePosition(a), right = parsePosition(b);
  if (left && right) return left.row - right.row || left.column - right.column;
  if (left || right) return left ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Positions as a bench reads them: runs along a row join up (A1–A8, B3). */
export function positionRanges(positions: string[]) {
  const sorted = [...new Set(positions.map(normalizePosition))].sort(comparePositions);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length;) {
    const first = parsePosition(sorted[index]);
    let end = index;
    while (first && end + 1 < sorted.length) {
      const next = parsePosition(sorted[end + 1]), current = parsePosition(sorted[end]);
      if (!next || !current || next.row !== first.row || next.column !== current.column + 1) break;
      end += 1;
    }
    parts.push(end > index ? `${sorted[index]}–${sorted[end]}` : sorted[index]);
    index = end + 1;
  }
  return parts.join(", ");
}

// Amounts: a number and a unit, compared through the Calculator's units.

/** "50 µL", "199.6 ng/uL" or a bare number; null when the text is not one. */
export function parseQuantityText(text: string | null | undefined): { value: number; unit: string } | null {
  const match = (text ?? "").normalize("NFKC").trim().replace(",", ".").match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/i);
  if (!match || !Number.isFinite(Number(match[1]))) return null;
  return { value: Number(match[1]), unit: sampleUnit(match[2]) };
}

/** A unit as stored: the Calculator's spelling when it knows it ("ng/ul" is ng/µL), else as typed. */
export function sampleUnit(unit: string | null | undefined) {
  const text = unit?.normalize("NFKC").trim().replace(/μ/g, "µ") ?? "";
  if (!text) return "";
  const keyboard = text.split("/").map((part) => part.replace(/^u([lgm]l?)$/i, (_, rest: string) => `µ${rest.toLowerCase() === "l" ? "L" : rest.replace(/l$/i, "L")}`)).join("/");
  return normalizeUnit(keyboard);
}

/**
 * What using `used` leaves of a sample, in the sample's unit. Null when the two cannot be compared (no amount,
 * different dimensions, unknown units); then nothing is subtracted and the use is only recorded.
 */
export function deductAmount(sample: { amount: number | null; amountUnit: string | null }, used: { value: number; unit: string }) {
  if (sample.amount === null || !sample.amountUnit || !(used.value > 0)) return null;
  const from = normalizeUnit(used.unit), to = normalizeUnit(sample.amountUnit);
  let deducted: number;
  if (from === to) deducted = used.value;
  else if (units[from] && units[to] && units[from].dimension === units[to].dimension) deducted = convert(used.value, from, to);
  else return null;
  deducted = Number(deducted.toPrecision(12));
  return { deducted, remaining: Number(Math.max(0, sample.amount - deducted).toPrecision(12)) };
}

// Batches: rows from the table, paste or file, checked before anything is written.

export type SampleRowInput = {
  code?: string; name?: string; typeId?: string; origin?: string; parentCode?: string;
  locationId?: string; position?: string;
  amount?: string; amountUnit?: string; concentration?: string; concentrationUnit?: string;
  collectedAt?: string; biosafetyLevel?: string; notes?: string; fields?: Record<string, string>;
};

export type SampleBatchContext = {
  types: Map<string, SampleTypeRef>;
  /** Codes already in use (matchKey). */
  existingCodes: Set<string>;
  /** Parents by code (matchKey). */
  parents: Map<string, { id: string; code: string; origin: string | null; status: string }>;
  locations: Map<string, { id: string; label: string; geometry: BoxGeometry | null }>;
  /** Positions held by samples in storage, by location. */
  occupied: Map<string, Set<string>>;
};

export type CheckedSampleRow = {
  index: number;
  problems: string[];
  value?: {
    code?: string; name: string; typeId: string; origin: string | null; parentId: string | null;
    locationId: string | null; position: string | null;
    amount: number | null; amountUnit: string | null; concentration: number | null; concentrationUnit: string | null;
    collectedAt: Date | null; biosafetyLevel: string | null; notes: string | null; fieldValues: Record<string, string>;
  };
};

const blank = (text: string | undefined) => !text?.trim();

/** 2026-10-31, 2026/10/31 or 2026.10.31 as a calendar day (UTC midnight); null when it is not a real day. */
export function parseSampleDate(text: string) {
  const match = text.normalize("NFKC").trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
const optionalNumber = (text: string | undefined, label: string, problems: string[]) => {
  if (blank(text)) return null;
  const value = Number(text!.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0) { problems.push(`${label} must be a number of 0 or more.`); return null; }
  return value;
};

/** A type's field values as typed; a number, date or choice must read as one (like inventory fields). */
export function checkFieldValues(fields: InventoryTypeField[], values: Record<string, string> | undefined, problems: string[]) {
  const checked: Record<string, string> = {};
  for (const field of fields) {
    const value = values?.[field.key]?.trim();
    if (!value) continue;
    if (field.kind === "number" && !Number.isFinite(Number(value))) problems.push(`${field.label} must be a number.`);
    else if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(`${field.label} must be a date.`);
    else if (field.kind === "choice" && field.options && !field.options.includes(value)) problems.push(`Choose one of the options for ${field.label}.`);
    else checked[field.key] = value;
  }
  return checked;
}

/**
 * Every row of a batch checked against the database and against the other rows: required name and type, codes
 * unique, the parent found, positions inside their box and not taken twice, numbers and dates readable.
 * Rows without a code get one from their type's prefix when saved.
 */
export function checkSampleRows(rows: SampleRowInput[], context: SampleBatchContext): { rows: CheckedSampleRow[]; ok: boolean } {
  const codes = new Map<string, number>(), places = new Map<string, number>();
  const checked = rows.map((row, index): CheckedSampleRow => {
    const problems: string[] = [];
    const name = row.name?.trim() ?? "";
    if (!name) problems.push("Name is required.");
    const type = row.typeId ? context.types.get(row.typeId) : undefined;
    if (!type) problems.push(row.typeId?.startsWith("unknown:") ? `Sample type ${row.typeId.slice(8)} was not found.` : "Choose a sample type.");
    const code = row.code?.trim();
    if (code) {
      const key = matchKey(code);
      if (context.existingCodes.has(key)) problems.push(`Code ${code} is already used.`);
      else if (codes.has(key)) problems.push(`Code ${code} repeats row ${codes.get(key)! + 1}.`);
      else codes.set(key, index);
    }
    const parent = row.parentCode?.trim() ? context.parents.get(matchKey(row.parentCode)) : undefined;
    if (row.parentCode?.trim() && !parent) problems.push(`Parent sample ${row.parentCode.trim()} was not found.`);
    const location = row.locationId ? context.locations.get(row.locationId) : undefined;
    if (row.locationId && !location) problems.push(row.locationId.startsWith("unknown:") ? `Box ${row.locationId.slice(8)} was not found.` : "The storage location no longer exists.");
    const position = normalizePosition(row.position);
    if (position && !location) problems.push("Choose a box for the position.");
    if (position && location) {
      const problem = positionProblem(position, location.geometry);
      if (problem) problems.push(problem);
      else if (context.occupied.get(location.id)?.has(position)) problems.push(`${location.label} ${position} already holds a sample.`);
      else {
        const key = `${location.id}\n${position}`;
        if (places.has(key)) problems.push(`${location.label} ${position} repeats row ${places.get(key)! + 1}.`);
        else places.set(key, index);
      }
    }
    const amount = optionalNumber(row.amount, "Amount", problems);
    const concentration = optionalNumber(row.concentration, "Concentration", problems);
    const amountUnit = sampleUnit(row.amountUnit) || (amount !== null ? type?.amountUnit ?? "" : "");
    const concentrationUnit = sampleUnit(row.concentrationUnit) || (concentration !== null ? type?.concentrationUnit ?? "" : "");
    if (amount !== null && !amountUnit) problems.push("Give the amount a unit.");
    if (concentration !== null && !concentrationUnit) problems.push("Give the concentration a unit.");
    let collectedAt: Date | null = null;
    if (!blank(row.collectedAt)) {
      collectedAt = parseSampleDate(row.collectedAt!);
      if (!collectedAt) problems.push("Date must be like 2026-10-31.");
    }
    const biosafetyLevel = row.biosafetyLevel?.trim().toUpperCase().replace(/^BSL\s*-?\s*/, "BSL-") || null;
    if (biosafetyLevel && !(biosafetyLevels as readonly string[]).includes(biosafetyLevel)) problems.push("Biosafety level must be BSL-1, BSL-2 or BSL-3.");
    const fieldValues = type ? checkFieldValues(type.fields, row.fields, problems) : {};
    if (problems.length || !type) return { index, problems };
    return {
      index, problems,
      value: {
        ...(code ? { code } : {}), name, typeId: type.id,
        origin: row.origin?.trim() || parent?.origin || null,
        parentId: parent?.id ?? null,
        locationId: location?.id ?? null, position: position || null,
        amount, amountUnit: amount === null ? null : amountUnit, concentration, concentrationUnit: concentration === null ? null : concentrationUnit,
        collectedAt, biosafetyLevel, notes: row.notes?.trim() || null, fieldValues,
      },
    };
  });
  if (rows.length > MAX_SAMPLE_BATCH) checked[0]?.problems.push(`One batch holds at most ${MAX_SAMPLE_BATCH} samples.`);
  return { rows: checked, ok: rows.length > 0 && rows.length <= MAX_SAMPLE_BATCH && checked.every((row) => !row.problems.length) };
}

// Columns of a pasted table or an import file, by their header.

export type SampleColumnKey = "code" | "name" | "type" | "origin" | "parent" | "box" | "position" | "amount" | "amountUnit" | "concentration" | "concentrationUnit" | "collectedAt" | "biosafetyLevel" | "notes";
export const sampleColumns: Array<{ key: SampleColumnKey; label: string; aliases: string[] }> = [
  { key: "code", label: "Code", aliases: ["code", "sample code", "编号", "样本编号", "条码", "barcode"] },
  { key: "name", label: "Name", aliases: ["name", "sample name", "sample id", "sample_id", "sampleid", "名称", "样本名", "样本名称", "样本id", "样本"] },
  { key: "type", label: "Type", aliases: ["type", "sample type", "类型", "样本类型"] },
  { key: "origin", label: "Origin", aliases: ["origin", "source", "subject", "donor", "来源", "来源个体", "患者", "个体"] },
  { key: "parent", label: "Parent sample", aliases: ["parent", "parent code", "parent sample", "母样本", "母样本编号"] },
  { key: "box", label: "Box", aliases: ["box", "location", "location | box", "盒子", "盒", "库位", "冻存盒"] },
  { key: "position", label: "Position", aliases: ["position", "well", "location | well", "slot", "位置", "孔位", "格位", "盒内位置"] },
  { key: "amount", label: "Amount", aliases: ["amount", "volume", "elution volume", "elution_volume", "体积", "量", "洗脱体积"] },
  { key: "amountUnit", label: "Amount unit", aliases: ["amount unit", "volume unit", "体积单位", "单位"] },
  { key: "concentration", label: "Concentration", aliases: ["concentration", "conc", "conc.", "浓度"] },
  { key: "concentrationUnit", label: "Concentration unit", aliases: ["concentration unit", "浓度单位"] },
  { key: "collectedAt", label: "Date", aliases: ["date", "collected", "collected at", "collection date", "日期", "采集日期", "制备日期"] },
  { key: "biosafetyLevel", label: "Biosafety level", aliases: ["bsl", "biosafety", "biosafety level", "生物安全等级"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "remarks", "备注", "说明"] },
];
const headerKey = (text: string) => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*[（(][^）)]*[）)]\s*$/, "");

/** Which sample column, or which field of the type (`field:<key>`), each header names; "" when none. */
export function mapSampleHeaders(headers: string[], fields: InventoryTypeField[] = []) {
  const used = new Set<string>();
  return headers.map((header) => {
    const key = headerKey(header);
    const field = fields.find((candidate) => headerKey(candidate.label) === key || headerKey(candidate.key) === key);
    const column = sampleColumns.find((candidate) => candidate.aliases.includes(key) || headerKey(candidate.label) === key || headerKey(candidate.key) === key)?.key ?? (field ? `field:${field.key}` : "");
    if (!column || used.has(column)) return "";
    used.add(column);
    return column;
  });
}

/**
 * Rows from table cells and the column each holds. "50 µL" in an amount column fills the amount and its unit;
 * a type is matched by its name in English or as shown, else by key; a box by its name.
 */
export function sampleRowsFromCells(cells: string[][], columns: string[], lookup: { typeId: (text: string) => string | undefined; locationId: (text: string) => string | undefined }) {
  return cells.filter((row) => row.some((cell) => cell?.trim())).map((row) => {
    const input: SampleRowInput = {};
    const fields: Record<string, string> = {};
    columns.forEach((column, index) => {
      const text = row[index]?.trim() ?? "";
      if (!column || !text) return;
      if (column.startsWith("field:")) { fields[column.slice(6)] = text; return; }
      switch (column as SampleColumnKey) {
        case "type": input.typeId = lookup.typeId(text) ?? `unknown:${text}`; break;
        case "box": input.locationId = lookup.locationId(text) ?? `unknown:${text}`; break;
        case "parent": input.parentCode = text; break;
        case "amount": case "concentration": {
          const parsed = parseQuantityText(text);
          const unitKey = column === "amount" ? "amountUnit" : "concentrationUnit";
          input[column as "amount" | "concentration"] = parsed ? String(parsed.value) : text;
          if (parsed?.unit && !input[unitKey]) input[unitKey] = parsed.unit;
          break;
        }
        default: input[column as Exclude<SampleColumnKey, "type" | "box" | "parent">] = text;
      }
    });
    if (Object.keys(fields).length) input.fields = fields;
    return input;
  });
}

// Lineage and what keeps a sample from being deleted.

/** A sample's ancestors from its parent up to the root; stops on a loop. */
export function ancestorsOf<T extends { id: string; parentId: string | null }>(sample: T, byId: Map<string, T>) {
  const chain: T[] = [];
  const seen = new Set([sample.id]);
  for (let parent = sample.parentId ? byId.get(sample.parentId) : undefined; parent && !seen.has(parent.id); parent = parent.parentId ? byId.get(parent.parentId) : undefined) {
    chain.push(parent);
    seen.add(parent.id);
  }
  return chain;
}

/** Children and experiments keep the record (S10); such a sample is marked discarded instead. */
export function sampleDeleteBlockers(counts: { children: number; experiments: number }) {
  return [
    counts.children ? `${counts.children} derived sample${counts.children === 1 ? "" : "s"}` : undefined,
    counts.experiments ? `${counts.experiments} experiment${counts.experiments === 1 ? "" : "s"}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

/** The boxes an experiment's samples are taken from, each with its positions (S15). */
export function samplesByBox(samples: Array<{ locationLabel: string | null; position: string | null }>) {
  const boxes = new Map<string, string[]>();
  let unplaced = 0;
  for (const sample of samples) {
    if (!sample.locationLabel) { unplaced += 1; continue; }
    boxes.set(sample.locationLabel, [...(boxes.get(sample.locationLabel) ?? []), ...(sample.position ? [sample.position] : [])]);
  }
  return { boxes: [...boxes].map(([label, positions]) => ({ label, count: samples.filter((sample) => sample.locationLabel === label).length, positions: positionRanges(positions) })), unplaced };
}

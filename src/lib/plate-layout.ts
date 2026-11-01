import { z } from "zod";

/**
 * A plate layout written in a document ("/板布局", Q255–Q256): one plate, the parameters its wells are given and the value
 * of each in each well. The shape follows the free plate planner's project backup, so layouts move both ways.
 * It is stored as one Markdown line, like a table, so documents need no new block type.
 */
export const PLATE_SIZES = [6, 12, 24, 48, 96, 384] as const;
export type PlateSize = (typeof PLATE_SIZES)[number];
const shapes: Record<PlateSize, { rows: number; columns: number }> = {
  6: { rows: 2, columns: 3 }, 12: { rows: 3, columns: 4 }, 24: { rows: 4, columns: 6 }, 48: { rows: 6, columns: 8 }, 96: { rows: 8, columns: 12 }, 384: { rows: 16, columns: 24 },
};
/** The free plate planner has no 48-well plate. */
export const PLANNER_PLATE_SIZES: readonly PlateSize[] = [6, 12, 24, 96, 384];
export const MAX_PLATE_FIELDS = 6;
/** Where values are filled in turn: N runs down each column (the planner's default), Z along each row. */
export type PlateOrder = "N" | "Z";

const sampleValueSchema = z.object({ sampleId: z.string().min(1).max(64), label: z.string().max(200) });
export const plateWellValueSchema = z.union([z.string().max(200), sampleValueSchema]);
export const plateFieldSchema = z.object({ id: z.string().min(1).max(40), name: z.string().max(30), unit: z.string().max(16).optional() });
export const plateLayoutSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(80),
  plateSize: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48), z.literal(96), z.literal(384)]),
  caption: z.string().max(1000).optional(),
  fields: z.array(plateFieldSchema).min(1).max(MAX_PLATE_FIELDS),
  colorField: z.string(),
  wells: z.record(z.string().regex(/^[A-P]\d{1,2}$/), z.record(z.string(), plateWellValueSchema)),
});
export type PlateWellValue = z.infer<typeof plateWellValueSchema>;
export type PlateField = z.infer<typeof plateFieldSchema>;
export type PlateLayout = z.infer<typeof plateLayoutSchema>;

export const plateShape = (size: PlateSize) => shapes[size];
export const newPlateId = () => `plate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
/** What a plate is called until someone names it: "96 孔板", "96-well plate". */
export const plateSizeName = (size: number, zh: boolean) => zh ? `${size} 孔板` : `${size}-well plate`;
export const plateRowLabel = (row: number) => String.fromCharCode(65 + row);
export const plateWellId = (row: number, column: number) => `${plateRowLabel(row)}${column + 1}`;

export function parsePlateWellId(id: string) {
  const match = /^([A-P])(\d{1,2})$/.exec(id);
  return match ? { row: match[1].charCodeAt(0) - 65, column: Number(match[2]) - 1 } : undefined;
}

export function isPlateSize(value: unknown): value is PlateSize {
  return PLATE_SIZES.includes(Number(value) as PlateSize);
}

/** Every well of the plate, along each row (Z) or down each column (N). */
export function plateWellIds(size: PlateSize, order: PlateOrder = "Z") {
  const { rows, columns } = shapes[size];
  const ids: string[] = [];
  if (order === "Z") for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) ids.push(plateWellId(row, column));
  else for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) ids.push(plateWellId(row, column));
  return ids;
}

/** The wells of the rectangle two wells span, as dragged. */
export function plateWellsInRect(from: string, to: string) {
  const a = parsePlateWellId(from), b = parsePlateWellId(to);
  if (!a || !b) return [];
  const ids: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++) for (let column = Math.min(a.column, b.column); column <= Math.max(a.column, b.column); column++) ids.push(plateWellId(row, column));
  return ids;
}

/** Shift-click: every well from one to the other in plate order (left to right, then down), as in the planner. */
export function plateWellRange(size: PlateSize, from: string, to: string) {
  const ids = plateWellIds(size, "Z"), start = ids.indexOf(from), end = ids.indexOf(to);
  return start < 0 || end < 0 ? [] : ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function plateRowWells(size: PlateSize, row: number) {
  return Array.from({ length: shapes[size].columns }, (_, column) => plateWellId(row, column));
}

export function plateColumnWells(size: PlateSize, column: number) {
  return Array.from({ length: shapes[size].rows }, (_, row) => plateWellId(row, column));
}

export const plateValueText = (value: PlateWellValue | undefined) => value === undefined ? "" : typeof value === "string" ? value : value.label;
export const plateValueKey = (value: PlateWellValue) => typeof value === "string" ? `text:${value.trim()}` : `sample:${value.sampleId}`;

export function newPlateLayout({ id, name, plateSize = 96, fieldNames }: { id: string; name: string; plateSize?: PlateSize; fieldNames: [string, string] }): PlateLayout {
  return { id, name, plateSize, fields: [{ id: "sample", name: fieldNames[0] }, { id: "treatment", name: fieldNames[1] }], colorField: "sample", wells: {} };
}

function withWells(layout: PlateLayout, wells: PlateLayout["wells"]): PlateLayout {
  return { ...layout, wells: Object.fromEntries(Object.entries(wells).filter(([, values]) => Object.keys(values).length)) };
}

/** Gives one parameter the same value in every chosen well; an empty value clears it there. */
export function setPlateValue(layout: PlateLayout, wellIds: string[], fieldId: string, value: PlateWellValue | null): PlateLayout {
  const wells = { ...layout.wells };
  const empty = value === null || (typeof value === "string" && !value.trim());
  for (const id of wellIds) {
    const rest = { ...wells[id] };
    delete rest[fieldId];
    wells[id] = empty ? rest : { ...rest, [fieldId]: typeof value === "string" ? value.trim() : value! };
  }
  return withWells(layout, wells);
}

export function clearPlateWells(layout: PlateLayout, wellIds: string[]): PlateLayout {
  const chosen = new Set(wellIds);
  return withWells(layout, Object.fromEntries(Object.entries(layout.wells).filter(([id]) => !chosen.has(id))));
}

/** Fills the chosen wells in plate order with each value `replicates` times in a row; what does not fit is counted, not dropped silently. */
export function fillPlateInOrder(layout: PlateLayout, wellIds: string[], fieldId: string, values: PlateWellValue[], { order, replicates }: { order: PlateOrder; replicates: number }) {
  const chosen = new Set(wellIds);
  const targets = plateWellIds(layout.plateSize, order).filter((id) => chosen.has(id));
  const sequence = values.flatMap((value) => Array.from({ length: Math.max(1, Math.round(replicates)) }, () => value));
  let next = layout;
  sequence.slice(0, targets.length).forEach((value, index) => { next = setPlateValue(next, [targets[index]], fieldId, value); });
  return { layout: next, filled: Math.min(sequence.length, targets.length), leftover: Math.max(0, sequence.length - targets.length) };
}

/** Another plate size keeps the wells that still exist; `dropped` counts the filled wells it loses. */
export function resizePlateLayout(layout: PlateLayout, plateSize: PlateSize) {
  const valid = new Set(plateWellIds(plateSize));
  const kept = Object.entries(layout.wells).filter(([id]) => valid.has(id));
  return { layout: { ...layout, plateSize, wells: Object.fromEntries(kept) }, dropped: Object.keys(layout.wells).length - kept.length };
}

/** Each value of the colouring parameter, in plate order, with its colour and how many wells hold it. */
export function plateLegend(layout: PlateLayout) {
  const entries = new Map<string, { key: string; label: string; tone: number; count: number }>();
  for (const id of plateWellIds(layout.plateSize)) {
    const value = layout.wells[id]?.[layout.colorField];
    if (value === undefined) continue;
    const key = plateValueKey(value), entry = entries.get(key);
    if (entry) entry.count += 1;
    else entries.set(key, { key, label: plateValueText(value), tone: entries.size % 12, count: 1 });
  }
  return [...entries.values()];
}

export function plateFilledCount(layout: PlateLayout) {
  return Object.keys(layout.wells).length;
}

export function plateSampleIds(layout: PlateLayout) {
  return [...new Set(Object.values(layout.wells).flatMap((values) => Object.values(values).flatMap((value) => typeof value === "string" ? [] : [value.sampleId])))];
}

// Stored as `<!--labnest-plate:…-->`. Everything but letters, digits and -_. is %-escaped, so no Markdown reader touches it.
const tokenPattern = /^<!--labnest-plate:([A-Za-z0-9%._-]+)-->$/;
const escapeToken = (value: string) => encodeURIComponent(value).replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

export function plateLayoutToMarkdown(layout: PlateLayout) {
  return `<!--labnest-plate:${escapeToken(JSON.stringify(layout))}-->`;
}

export function plateLayoutFromMarkdown(line: string): PlateLayout | undefined {
  const match = tokenPattern.exec(line.trim());
  if (!match) return undefined;
  try {
    const parsed = plateLayoutSchema.safeParse(JSON.parse(decodeURIComponent(match[1])));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function plateLayoutsInText(text: string) {
  return text.split("\n").flatMap((line) => plateLayoutFromMarkdown(line) ?? []);
}

/** How a plate reads in search, Entry summaries and exports: its name and size, then every value it holds. */
export function plateLayoutPlainText(layout: PlateLayout) {
  const values = new Set(Object.values(layout.wells).flatMap((well) => Object.values(well).map(plateValueText)).filter(Boolean));
  return [`板布局：${layout.name || `${layout.plateSize} 孔板`}（${layout.plateSize} 孔）`, ...values].join(" ");
}

/** Markdown with each plate line replaced by how the plate reads. */
export function platesAsText(markdown: string) {
  return markdown.split("\n").map((line) => { const plate = plateLayoutFromMarkdown(line); return plate ? plateLayoutPlainText(plate) : line; }).join("\n");
}

/** Rows of a printable table: a header of column numbers, then each row's wells as the colouring parameter's value. */
export function plateLayoutTableRows(layout: PlateLayout) {
  const { rows, columns } = shapes[layout.plateSize];
  return [["", ...Array.from({ length: columns }, (_, column) => String(column + 1))],
    ...Array.from({ length: rows }, (_, row) => [plateRowLabel(row), ...Array.from({ length: columns }, (_, column) => plateValueText(layout.wells[plateWellId(row, column)]?.[layout.colorField]))])];
}

type PlannerDimension = { id: string; name: string; type: "text" | "number"; unit: string };

/**
 * Plates from the free plate planner's project backup (version 2, or the single-plate shape before it).
 * Wells keep the planner's values as text; a backup with more than six parameters keeps the six that hold the most values.
 */
export function plateLayoutsFromPlannerBackup(raw: unknown, newId: () => string): PlateLayout[] {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const plates = Array.isArray(source.plates) && Number(source.version) === 2 ? source.plates : [source];
  return plates.flatMap((plate): PlateLayout[] => {
    if (!plate || typeof plate !== "object") return [];
    const item = plate as Record<string, unknown>, size = Number(item.plateSize);
    if (!isPlateSize(size)) return [];
    const maps = item.plates && typeof item.plates === "object" ? (item.plates as Record<string, unknown>)[String(size)] : item.wells;
    const wells: Record<string, Record<string, string>> = {};
    for (const [wellId, well] of Object.entries(maps && typeof maps === "object" ? maps as Record<string, unknown> : {})) {
      const params = well && typeof well === "object" ? (well as { params?: unknown }).params : undefined;
      if (!parsePlateWellId(wellId) || !params || typeof params !== "object") continue;
      const values = Object.entries(params as Record<string, unknown>).filter(([, value]) => (typeof value === "string" && value.trim()) || typeof value === "number").map(([key, value]) => [key, String(value).trim().slice(0, 200)]);
      if (values.length) wells[wellId] = Object.fromEntries(values);
    }
    const dimensions = (Array.isArray(item.dimensions) ? item.dimensions : []).filter((d): d is { id: string; name: string; unit?: unknown } =>
      Boolean(d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string" && typeof (d as { name?: unknown }).name === "string"));
    const used = (id: string) => Object.values(wells).filter((values) => values[id] !== undefined).length;
    const kept = [...dimensions].sort((a, b) => used(b.id) - used(a.id)).slice(0, MAX_PLATE_FIELDS);
    const fields: PlateField[] = dimensions.filter((d) => kept.includes(d)).map((d) => ({ id: d.id.slice(0, 40), name: d.name.slice(0, 30), ...(typeof d.unit === "string" && d.unit.trim() ? { unit: d.unit.trim().slice(0, 16) } : {}) }));
    if (!fields.length) fields.push({ id: "sample", name: "Sample" });
    const fieldIds = new Set(fields.map((field) => field.id));
    const color = typeof item.colorDimension === "string" && fieldIds.has(item.colorDimension) ? item.colorDimension : fields[0].id;
    const keptWells = Object.fromEntries(Object.entries(wells).map(([id, values]) => [id, Object.fromEntries(Object.entries(values).filter(([key]) => fieldIds.has(key)))]).filter(([, values]) => Object.keys(values).length));
    const parsed = plateLayoutSchema.safeParse({ id: newId(), name: String(item.name ?? "").trim().slice(0, 80), plateSize: size, fields, colorField: color, wells: keptWells });
    return parsed.success ? [parsed.data] : [];
  });
}

/** A project backup the free plate planner restores (version 2). A 48-well plate is left out: the planner has none. */
export function plateLayoutsToPlannerBackup(layouts: PlateLayout[], name: string) {
  const plates = layouts.filter((layout) => PLANNER_PLATE_SIZES.includes(layout.plateSize)).map((layout) => {
    const dimensions: PlannerDimension[] = layout.fields.map((field) => {
      const numeric = Boolean(field.unit) && Object.values(layout.wells).every((values) => values[field.id] === undefined || (typeof values[field.id] === "string" && Number.isFinite(Number(values[field.id]))));
      return { id: field.id, name: field.name || field.id, type: numeric ? "number" : "text", unit: numeric ? field.unit ?? "" : "" };
    });
    const wells = Object.fromEntries(Object.entries(layout.wells).map(([id, values]) => [id, { params: Object.fromEntries(Object.entries(values).map(([key, value]) => {
      const dimension = dimensions.find((d) => d.id === key), text = plateValueText(value);
      return [key, dimension?.type === "number" ? Number(text) : text];
    })) }]));
    return { id: layout.id, name: layout.name || `${layout.plateSize}-well plate`, plateSize: layout.plateSize, dimensions, plates: { 6: {}, 12: {}, 24: {}, 96: {}, 384: {}, [layout.plateSize]: wells }, colorDimension: layout.colorField };
  });
  return { version: 2, id: `workspace-${layouts[0]?.id ?? "labnest"}`, name: name.slice(0, 80), activePlateId: plates[0]?.id ?? "", plates, updatedAt: new Date().toISOString() };
}

import { z } from "zod";
import type {
  ConsumptionRule,
  ProtocolMaterial,
  ProtocolStep,
  ResultTemplate,
} from "./types";

export const protocolSectionKeys = [
  "description",
  "purpose",
  "background",
  "material",
  "steps",
  "result_templates",
  "consumption_rules",
] as const;

export type ProtocolSectionKey = (typeof protocolSectionKeys)[number];

export const protocolSectionLabels: Record<ProtocolSectionKey, string> = {
  description: "Description",
  purpose: "Purpose",
  background: "Background",
  material: "Material",
  steps: "Steps",
  result_templates: "Result Templates",
  consumption_rules: "Consumption Rules",
};

const baseBlockSchema = z.object({ id: z.string().min(1) });

export const protocolContentBlockSchema = z.discriminatedUnion("type", [
  baseBlockSchema.extend({ type: z.literal("heading"), text: z.string() }),
  baseBlockSchema.extend({ type: z.literal("text"), text: z.string() }),
  baseBlockSchema.extend({
    type: z.literal("checklist"),
    items: z.array(z.string()),
  }),
  baseBlockSchema.extend({
    type: z.literal("table"),
    caption: z.string().optional(),
    rows: z.array(z.array(z.string())),
  }),
  baseBlockSchema.extend({
    type: z.literal("callout"),
    tone: z.enum(["note", "warning", "critical"]),
    text: z.string(),
  }),
]);

export type ProtocolContentBlock = z.infer<typeof protocolContentBlockSchema>;

export const protocolDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  sections: z.array(
    z.object({
      key: z.enum(protocolSectionKeys),
      title: z.string(),
      blocks: z.array(protocolContentBlockSchema),
    }),
  ),
  importWarnings: z.array(z.string()).default([]),
});

export type ProtocolDocument = z.infer<typeof protocolDocumentSchema>;

function blockId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

export function createEmptyProtocolDocument(): ProtocolDocument {
  return {
    schemaVersion: 1,
    sections: protocolSectionKeys.map((key) => ({
      key,
      title: protocolSectionLabels[key],
      blocks: [],
    })),
    importWarnings: [],
  };
}

export function normalizeProtocolDocument(value: unknown): ProtocolDocument | undefined {
  const result = protocolDocumentSchema.safeParse(value);
  if (!result.success) return undefined;

  const byKey = new Map(result.data.sections.map((section) => [section.key, section]));
  return {
    ...result.data,
    sections: protocolSectionKeys.map((key) =>
      byKey.get(key) ?? { key, title: protocolSectionLabels[key], blocks: [] },
    ),
  };
}

export function protocolDocumentFromLegacy({
  description,
  purpose,
  background,
  materials,
  equipment,
  steps,
  resultTemplates,
  consumptionRules,
}: {
  description?: string | null;
  purpose?: string | null;
  background?: string | null;
  materials: ProtocolMaterial[];
  equipment: ProtocolMaterial[];
  steps: ProtocolStep[];
  resultTemplates: ResultTemplate[];
  consumptionRules: ConsumptionRule[];
}): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  const section = (key: ProtocolSectionKey) =>
    document.sections.find((item) => item.key === key) as ProtocolDocument["sections"][number];

  if (description) section("description").blocks.push({ id: "description-1", type: "text", text: description });
  if (purpose) section("purpose").blocks.push({ id: "purpose-1", type: "text", text: purpose });
  if (background) section("background").blocks.push({ id: "background-1", type: "text", text: background });

  const materialRows = [
    ["Name", "Unit", "Role", "Notes"],
    ...materials.map((item) => [item.name, item.unit ?? "", item.role ?? "", item.notes ?? ""]),
  ];
  if (materials.length) {
    section("material").blocks.push({ id: "material-table-1", type: "table", caption: "Materials", rows: materialRows });
  }
  if (equipment.length) {
    section("material").blocks.push({
      id: "equipment-table-1",
      type: "table",
      caption: "Equipment",
      rows: [
        ["Name", "Notes"],
        ...equipment.map((item) => [item.name, item.notes ?? item.role ?? ""]),
      ],
    });
  }
  if (steps.length) {
    section("steps").blocks.push({
      id: "steps-1",
      type: "checklist",
      items: steps.map((item) => `${item.title}${item.description ? ` — ${item.description}` : ""}`),
    });
  }
  resultTemplates.forEach((template, index) => {
    section("result_templates").blocks.push({
      id: blockId("result-template", index),
      type: "table",
      caption: template.result_type,
      rows: [
        ["Field", "Type", "Unit", "Required"],
        ...template.fields.map((field) => [
          field.name,
          field.type,
          field.unit ?? "",
          field.required ? "Yes" : "No",
        ]),
      ],
    });
  });
  if (consumptionRules.length) {
    section("consumption_rules").blocks.push({
      id: "consumption-table-1",
      type: "table",
      rows: [
        ["Material", "Formula", "Unit"],
        ...consumptionRules.map((item) => [item.material_name, item.formula, item.unit]),
      ],
    });
  }

  return document;
}

export function sectionPlainText(document: ProtocolDocument, key: ProtocolSectionKey) {
  const section = document.sections.find((item) => item.key === key);
  if (!section) return "";
  return section.blocks
    .flatMap((block) => {
      if (block.type === "heading" || block.type === "text" || block.type === "callout") return [block.text];
      if (block.type === "checklist") return block.items;
      return block.rows.flat();
    })
    .filter(Boolean)
    .join("\n");
}

export function projectProtocolDocument(document: ProtocolDocument) {
  const materialSection = document.sections.find((item) => item.key === "material");
  const stepSection = document.sections.find((item) => item.key === "steps");
  const resultSection = document.sections.find((item) => item.key === "result_templates");
  const consumptionSection = document.sections.find((item) => item.key === "consumption_rules");

  const materials: ProtocolMaterial[] = (materialSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table")
    .flatMap((block) => block.rows.slice(1).map((row) => ({
      name: row[0] ?? "",
      notes: row.slice(1).filter(Boolean).join(" | ") || undefined,
    })))
    .filter((item) => item.name);

  const steps: ProtocolStep[] = [];
  let currentHeading = "Step";
  for (const block of stepSection?.blocks ?? []) {
    if (block.type === "heading") currentHeading = block.text;
    if (block.type === "checklist") {
      for (const item of block.items) {
        steps.push({
          order: steps.length + 1,
          title: currentHeading,
          description: item,
          requires_confirmation: true,
          allows_deviation: true,
        });
      }
    }
  }

  const resultTemplates: ResultTemplate[] = (resultSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table" && block.rows.length > 1)
    .map((block, index) => ({
      result_type: block.caption || `result_template_${index + 1}`,
      fields: (block.rows[0] ?? []).map((name) => ({ name: name || "field", type: "text" as const })),
    }));

  const consumptionRules: ConsumptionRule[] = (consumptionSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table")
    .flatMap((block) => block.rows.slice(1).map((row) => ({
      material_name: row[0] ?? "",
      formula: row[1] ?? "",
      unit: row[2] ?? "",
    })))
    .filter((item) => item.material_name && item.formula);

  return {
    description: sectionPlainText(document, "description"),
    purpose: sectionPlainText(document, "purpose"),
    background: sectionPlainText(document, "background"),
    materials,
    steps,
    resultTemplates,
    consumptionRules,
  };
}

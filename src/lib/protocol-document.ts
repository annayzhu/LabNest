import { z } from "zod";
import type {
  ConsumptionRule,
  ProtocolMaterial,
  ProtocolStep,
  ResultTemplate,
} from "./types";
import {
  normalizeResultTemplate,
  resultTemplateFieldsToRows,
  resultTemplateInputSchema,
} from "./result-templates";

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

export const protocolRichTextRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.string().optional(),
});

export const protocolRichTextNodeSchema = z.object({
  type: z.enum(["paragraph", "heading2", "heading3", "bullet", "numbered", "quote"]),
  content: z.array(protocolRichTextRunSchema),
});

export type ProtocolRichTextRun = z.infer<typeof protocolRichTextRunSchema>;
export type ProtocolRichTextNode = z.infer<typeof protocolRichTextNodeSchema>;

export const protocolContentBlockSchema = z.discriminatedUnion("type", [
  baseBlockSchema.extend({ type: z.literal("heading"), text: z.string() }),
  baseBlockSchema.extend({ type: z.literal("text"), text: z.string() }),
  baseBlockSchema.extend({
    type: z.literal("rich_text"),
    nodes: z.array(protocolRichTextNodeSchema),
  }),
  baseBlockSchema.extend({
    type: z.literal("checklist"),
    items: z.array(z.string()),
  }),
  baseBlockSchema.extend({
    type: z.literal("media"),
    mediaType: z.enum(["image", "video", "file"]),
    url: z.string(),
    caption: z.string().optional(),
  }),
  baseBlockSchema.extend({
    type: z.literal("timer"),
    label: z.string(),
    durationMinutes: z.number().finite().positive(),
    notes: z.string().optional(),
  }),
  baseBlockSchema.extend({
    type: z.literal("table"),
    caption: z.string().optional(),
    rows: z.array(z.array(z.string())),
    resultTemplate: resultTemplateInputSchema.optional(),
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

export function richTextFromPlainText(text: string): ProtocolRichTextNode[] {
  const lines = text.split(/\r?\n/);
  return (lines.length ? lines : [""]).map((line) => ({
    type: "paragraph" as const,
    content: [{ text: line }],
  }));
}

export function richTextPlainText(nodes: ProtocolRichTextNode[]) {
  return nodes.map((node) => node.content.map((run) => run.text).join("")).join("\n");
}

export function createProtocolTemplateDocument(): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  const section = (key: ProtocolSectionKey) => document.sections.find((item) => item.key === key)!;
  for (const key of ["description", "purpose", "background"] as const) {
    section(key).blocks.push({ id: `${key}-rich-1`, type: "rich_text", nodes: richTextFromPlainText("") });
  }
  section("material").blocks.push({ id: "material-table-1", type: "table", caption: "Materials", rows: [["Name", "Unit", "Role", "Notes"], ["", "", "", ""]] });
  section("steps").blocks.push({ id: "steps-rich-1", type: "rich_text", nodes: [{ type: "numbered", content: [{ text: "" }] }] });
  const resultTemplate = normalizeResultTemplate({ result_type: "result_type", templateKey: "result_type", fields: [], datasets: [], artifacts: [], view: { preset: "generic", charts: [] } });
  section("result_templates").blocks.push({ id: "result-template-1", type: "table", caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate });
  section("consumption_rules").blocks.push({ id: "consumption-table-1", type: "table", caption: "Consumption rules", rows: [["Material", "Formula", "Unit"], ["", "", ""]] });
  return document;
}

export function upgradeProtocolDocumentForEditing(document: ProtocolDocument): ProtocolDocument {
  const projectedTemplates = projectProtocolDocument(document).resultTemplates;
  let resultTemplateIndex = 0;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (block.type === "text") return { id: block.id, type: "rich_text" as const, nodes: richTextFromPlainText(block.text) };
        if (section.key === "result_templates" && block.type === "table") {
          const template = normalizeResultTemplate(block.resultTemplate ?? projectedTemplates[resultTemplateIndex], resultTemplateIndex);
          resultTemplateIndex += 1;
          return { ...block, caption: template.result_type, rows: resultTemplateFieldsToRows(template), resultTemplate: template };
        }
        return block;
      }),
    })),
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
    const normalizedTemplate = normalizeResultTemplate(template, index);
    section("result_templates").blocks.push({
      id: blockId("result-template", index),
      type: "table",
      caption: normalizedTemplate.result_type,
      rows: resultTemplateFieldsToRows(normalizedTemplate),
      resultTemplate: normalizedTemplate,
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
      if (block.type === "rich_text") return [richTextPlainText(block.nodes)];
      if (block.type === "checklist") return block.items;
      if (block.type === "table") return block.rows.flat();
      if (block.type === "media") return [block.caption ?? block.url];
      return [`${block.label}: ${block.durationMinutes} min`, block.notes ?? ""];
    })
    .filter(Boolean)
    .join("\n");
}

export function projectProtocolDocument(document: ProtocolDocument) {
  const materialSection = document.sections.find((item) => item.key === "material");
  const stepSection = document.sections.find((item) => item.key === "steps");
  const resultSection = document.sections.find((item) => item.key === "result_templates");
  const consumptionSection = document.sections.find((item) => item.key === "consumption_rules");

  const materialTables = (materialSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table");
  const tableIndex = (headers: string[], candidates: string[], fallback: number) => {
    const normalized = headers.map((header) => header.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ""));
    const index = normalized.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
    return index >= 0 ? index : fallback;
  };
  const materials: ProtocolMaterial[] = [];
  const equipment: ProtocolMaterial[] = [];
  for (const block of materialTables) {
    const headers = block.rows[0] ?? [];
    const nameIndex = tableIndex(headers, ["name", "material", "reagent", "名称", "材料", "试剂", "设备"], 0);
    const unitIndex = tableIndex(headers, ["unit", "单位"], -1);
    const roleIndex = tableIndex(headers, ["role", "use", "用途", "作用"], -1);
    const notesIndex = tableIndex(headers, ["note", "setting", "amount", "备注", "条件", "用量"], -1);
    const target = /equipment|instrument|设备|仪器/i.test(block.caption ?? "") ? equipment : materials;
    for (const row of block.rows.slice(1)) {
      const name = row[nameIndex]?.trim() ?? "";
      if (!name) continue;
      target.push({
        name,
        unit: unitIndex >= 0 ? row[unitIndex]?.trim() || undefined : undefined,
        role: roleIndex >= 0 ? row[roleIndex]?.trim() || undefined : undefined,
        notes: (notesIndex >= 0 ? row[notesIndex]?.trim() : "") || row.filter((_, index) => ![nameIndex, unitIndex, roleIndex].includes(index)).filter(Boolean).join(" | ") || undefined,
      });
    }
  }

  const steps: ProtocolStep[] = [];
  let currentHeading: string | undefined;
  let currentDescription: string[] = [];
  const flushStep = () => {
    const description = currentDescription.filter(Boolean).join("\n").trim();
    if (currentHeading) steps.push({ order: steps.length + 1, title: currentHeading.replace(/^\d+[.、]\s*/, "") || `Step ${steps.length + 1}`, description, requires_confirmation: true, allows_deviation: true });
    else if (description) steps.push({ order: steps.length + 1, title: description.split("\n")[0], description: description.split("\n").slice(1).join("\n"), requires_confirmation: true, allows_deviation: true });
    currentHeading = undefined;
    currentDescription = [];
  };
  for (const block of stepSection?.blocks ?? []) {
    if (block.type === "heading") { flushStep(); currentHeading = block.text; }
    if (block.type === "text") {
      if (currentHeading) currentDescription.push(block.text);
      else { currentDescription.push(block.text); flushStep(); }
    }
    if (block.type === "rich_text") {
      for (const node of block.nodes) {
        const text = node.content.map((run) => run.text).join("").trim();
        if (!text) continue;
        if (node.type === "numbered") {
          flushStep();
          currentHeading = text;
        } else if (currentHeading) currentDescription.push(node.type === "bullet" ? `• ${text}` : text);
        else { currentDescription.push(text); flushStep(); }
      }
    }
    if (block.type === "checklist") {
      if (currentHeading) {
        currentDescription.push(...block.items.filter((item) => item.trim()));
      } else {
        flushStep();
        for (const item of block.items) {
          if (!item.trim()) continue;
          steps.push({ order: steps.length + 1, title: item, description: "", requires_confirmation: true, allows_deviation: true });
        }
      }
    }
  }
  flushStep();

  const resultTemplates: ResultTemplate[] = (resultSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table" && block.rows.length > 1)
    .map((block, index) => {
      if (block.resultTemplate) return normalizeResultTemplate({ ...block.resultTemplate, result_type: block.caption || block.resultTemplate.result_type }, index);
      const headers = block.rows[0] ?? [];
      const fieldIndex = tableIndex(headers, ["fieldkey", "field", "name", "字段键", "字段", "名称"], 0);
      const labelIndex = tableIndex(headers, ["label", "displayname", "显示名", "标签"], -1);
      const typeIndex = tableIndex(headers, ["type", "类型"], 1);
      const unitIndex = tableIndex(headers, ["unit", "单位"], 2);
      const requiredIndex = tableIndex(headers, ["required", "必填"], 3);
      const roleIndex = tableIndex(headers, ["role", "semanticrole", "语义角色", "角色"], -1);
      const optionsIndex = tableIndex(headers, ["options", "选项"], -1);
      const minIndex = tableIndex(headers, ["min", "minimum", "最小值"], -1);
      const maxIndex = tableIndex(headers, ["max", "maximum", "最大值"], -1);
      const allowedTypes = new Set(["text", "number", "select", "attachment[]", "boolean", "date", "datetime"]);
      const allowedRoles = new Set(["identifier", "design", "group", "label", "measurement", "qc", "annotation"]);
      const isLegacyFieldTable = labelIndex < 0 && roleIndex < 0 && optionsIndex < 0 && minIndex < 0 && maxIndex < 0;
      const fields = block.rows.slice(1).map((row) => {
        const rawType = row[typeIndex]?.trim().toLowerCase() ?? "text";
        const key = row[fieldIndex]?.trim() ?? "";
        const label = labelIndex >= 0 ? row[labelIndex]?.trim() || key : key;
        const min = minIndex >= 0 && row[minIndex]?.trim() ? Number(row[minIndex]) : undefined;
        const max = maxIndex >= 0 && row[maxIndex]?.trim() ? Number(row[maxIndex]) : undefined;
        const rawRole = roleIndex >= 0 ? row[roleIndex]?.trim() : undefined;
        if (isLegacyFieldTable) return {
          name: label,
          type: (allowedTypes.has(rawType) ? rawType : "text") as "text" | "number" | "select" | "attachment[]" | "boolean" | "date" | "datetime",
          unit: row[unitIndex]?.trim() || undefined,
          required: /^(yes|true|1|是|必填)$/i.test(row[requiredIndex]?.trim() ?? ""),
        };
        return {
          key,
          label,
          name: label,
          dataType: (allowedTypes.has(rawType) ? rawType : "text") as "text" | "number" | "select" | "attachment[]" | "boolean" | "date" | "datetime",
          type: (allowedTypes.has(rawType) ? rawType : "text") as "text" | "number" | "select" | "attachment[]" | "boolean" | "date" | "datetime",
          unit: row[unitIndex]?.trim() || undefined,
          required: /^(yes|true|1|是|必填)$/i.test(row[requiredIndex]?.trim() ?? ""),
          semanticRole: rawRole && allowedRoles.has(rawRole) ? rawRole as ResultTemplate["fields"][number]["semanticRole"] : undefined,
          options: optionsIndex >= 0 ? row[optionsIndex]?.split(/[|;,；，]/).map((item) => item.trim()).filter(Boolean) : undefined,
          validation: min !== undefined || max !== undefined ? { min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined } : undefined,
        };
      }).filter((field) => ("key" in field ? field.key : field.name));
      const normalizedHeaders = headers.map((header) => header.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ""));
      const isFieldDefinitionTable = normalizedHeaders.some((header) => ["field", "name", "字段", "名称"].some((candidate) => header.includes(candidate)))
        && normalizedHeaders.some((header) => ["type", "类型"].some((candidate) => header.includes(candidate)));
      return {
        result_type: block.caption || `result_template_${index + 1}`,
        fields: fields.length
          ? fields
          : isFieldDefinitionTable
            ? []
            : headers.filter(Boolean).map((name) => ({ name, type: "text" as const })),
      };
    });

  const consumptionRules: ConsumptionRule[] = (consumptionSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table")
    .flatMap((block) => {
      const headers = block.rows[0] ?? [];
      const materialIndex = tableIndex(headers, ["material", "name", "材料", "名称"], 0);
      const formulaIndex = tableIndex(headers, ["formula", "calculation", "公式", "计算"], 1);
      const unitIndex = tableIndex(headers, ["unit", "单位"], 2);
      return block.rows.slice(1).map((row) => ({ material_name: row[materialIndex] ?? "", formula: row[formulaIndex] ?? "", unit: row[unitIndex] ?? "" }));
    })
    .filter((item) => item.material_name && item.formula);

  return {
    description: sectionPlainText(document, "description"),
    purpose: sectionPlainText(document, "purpose"),
    background: sectionPlainText(document, "background"),
    materials,
    equipment,
    steps,
    resultTemplates,
    consumptionRules,
  };
}

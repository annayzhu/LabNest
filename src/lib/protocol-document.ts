import { projectProtocolExecution } from "./protocol-execution";
import { paragraphLayoutFields } from "./document-paragraph-layout";
import { z } from "zod";
import { documentMediaFields, documentMediaFromMarkdown } from "./document-media";
import type {
  ConsumptionRule,
  ProtocolMaterial,
  ProtocolStep,
  ResultFieldDataType,
  ResultSemanticRole,
  ResultTemplate,
} from "./types";
import {
  normalizeResultTemplate,
  resultTemplateFieldsToRows,
  resultTemplateInputSchema,
} from "./result-templates";
import { parseRichTextFontFamily, type RichTextFontFamily } from "./rich-text-font-family";
import { richTextFontSizeSchema } from "./rich-text-font-size-schema";
import { RICH_TEXT_COLORS } from "./rich-text-color";
import { tiptapCellRichContentSchema } from "./tiptap-json-schema";

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

export const protocolExecutionRoleSchema = z.object({
  role: z.enum(["step", "detail", "info"]),
  stepId: z.string().min(1).optional(),
  title: z.string().optional(),
  titlePrefix: z.string().optional(),
  requiresConfirmation: z.boolean().optional(),
  allowsDeviation: z.boolean().optional(),
});
const baseBlockSchema = z.object({ id: z.string().min(1), execution: protocolExecutionRoleSchema.optional() });

export const protocolRichTextRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  subscript: z.boolean().optional(),
  superscript: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.string().optional(),
  color: z.enum(RICH_TEXT_COLORS).optional(),
  fontSizePt: richTextFontSizeSchema.optional(),
  fontFamily: z.custom<RichTextFontFamily>((value) => typeof value === "string" && Boolean(parseRichTextFontFamily(value))).optional(),
});

export const protocolRichTextNodeSchema = z.object({
  childContent: tiptapCellRichContentSchema.optional(),
  ...paragraphLayoutFields,
  type: z.enum(["paragraph", "heading2", "heading3", "bullet", "numbered", "quote"]),
  content: z.array(protocolRichTextRunSchema),
  lineHeight: z.union([z.literal(1), z.literal(1.15), z.literal(1.3), z.literal(1.5), z.literal(1.6), z.literal(2)]).optional(),
  fontFamily: z.custom<RichTextFontFamily>((value) => typeof value === "string" && Boolean(parseRichTextFontFamily(value))).optional(),
});

export type ProtocolRichTextRun = z.infer<typeof protocolRichTextRunSchema>;
export type ProtocolRichTextNode = z.infer<typeof protocolRichTextNodeSchema>;

export const protocolContentBlockSchema = z.discriminatedUnion("type", [
  baseBlockSchema.extend({ type: z.literal("heading"), text: z.string(), nodes:z.array(protocolRichTextNodeSchema).optional() }),
  baseBlockSchema.extend({ type: z.literal("text"), text: z.string(), nodes:z.array(protocolRichTextNodeSchema).optional() }),
  baseBlockSchema.extend({
    type: z.literal("rich_text"),
    nodes: z.array(protocolRichTextNodeSchema),
  }),
  baseBlockSchema.extend({
    type: z.literal("checklist"),
    items: z.array(z.string()),
    itemNodes:z.array(z.array(protocolRichTextNodeSchema)).optional(),
  }),
  baseBlockSchema.extend(documentMediaFields),
  baseBlockSchema.extend({
    type: z.literal("embedded_tool"),
    sourceKind: z.enum(["manifest", "url", "path"]),
    label: z.string(),
    url: z.string(),
    toolId: z.string().optional(),
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
    columnWidths: z.array(z.number().finite().positive().nullable()).optional(),
    cellFontSizesPt: z.array(z.array(richTextFontSizeSchema.nullable())).optional(),
    cellColors: z.array(z.array(z.enum(RICH_TEXT_COLORS).nullable())).optional(),
    cellRichContent: z.array(z.array(tiptapCellRichContentSchema.nullable())).optional(),
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
  executionConfirmed: z.boolean().optional(),
  sections: z.array(
    z.object({
      key: z.enum(protocolSectionKeys),
      title: z.string(),
      titleFontSizePt: richTextFontSizeSchema.optional(),
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
  const childText = (value: unknown): string => {
    if (!value || typeof value !== "object") return "";
    if (Array.isArray(value)) return value.map(childText).filter(Boolean).join("\n");
    const node = value as { text?: string; content?: unknown };
    return typeof node.text === "string" ? node.text : childText(node.content);
  };
  return nodes.map((node) => {
    const text = node.content.map((run) => run.text).join("");
    const media = documentMediaFromMarkdown(text);
    return [media ? [media.filename, media.caption].filter(Boolean).join(" ") : text, childText(node.childContent)].filter(Boolean).join("\n");
  }).join("\n");
}

export function createProtocolTemplateDocument(): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  const section = (key: ProtocolSectionKey) => document.sections.find((item) => item.key === key)!;
  for (const key of ["description", "purpose", "background"] as const) {
    section(key).blocks.push({ id: `${key}-rich-1`, type: "rich_text", nodes: richTextFromPlainText("") });
  }
  section("material").blocks.push({ id: "material-table-1", type: "table", caption: "Materials", rows: [["Name", "Unit", "Role", "Notes"], ["", "", "", ""]] });
  section("steps").blocks.push({ id: "steps-rich-1", type: "rich_text", nodes: [{ type: "numbered", content: [{ text: "" }] }] });
  const resultTemplate = normalizeResultTemplate({ result_type: "result_type", templateKey: "result_type", instructions: richTextFromPlainText(""), fields: [], datasets: [], artifacts: [], view: { preset: "generic", charts: [] } });
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
        if (block.type === "text") return { ...block, type: "rich_text" as const, nodes: block.nodes ?? richTextFromPlainText(block.text) };
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
  for(const [index,step] of steps.entries()) {
    const ref=step.source_ref??`legacy-step-${index+1}`;
    section("steps").blocks.push({id:ref,type:"heading",text:step.title || `Step ${index+1}`,execution:{role:"step",stepId:ref,title:step.title,requiresConfirmation:step.requires_confirmation,allowsDeviation:step.allows_deviation}});
    const detail=step.content_blocks?.length?step.content_blocks:step.description?[{id:`${ref}-detail`,type:"text" as const,text:step.description}]:[];
    section("steps").blocks.push(...detail.map(block=>({...block,execution:{role:"detail" as const,stepId:ref}})));
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
      if (block.type === "embedded_tool") return [block.label || block.url];
      return [`${block.label}: ${block.durationMinutes} min`, block.notes ?? ""];
    })
    .filter(Boolean)
    .join("\n");
}

function resultFieldDataTypeFromText(value: string | undefined): ResultFieldDataType {
  const normalized = (value || "text").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\[\]]/g, "");
  const aliases: Record<string, ResultFieldDataType> = {
    text: "text",
    string: "text",
    str: "text",
    文本: "text",
    文字: "text",
    字符串: "text",
    number: "number",
    numeric: "number",
    num: "number",
    float: "number",
    double: "number",
    integer: "number",
    int: "number",
    数值: "number",
    数字: "number",
    数量: "number",
    浓度: "number",
    select: "select",
    enum: "select",
    choice: "select",
    option: "select",
    options: "select",
    选项: "select",
    选择: "select",
    下拉: "select",
    枚举: "select",
    "attachment[]": "attachment[]",
    attachment: "attachment[]",
    attachments: "attachment[]",
    file: "attachment[]",
    files: "attachment[]",
    image: "attachment[]",
    media: "attachment[]",
    文件: "attachment[]",
    附件: "attachment[]",
    图片: "attachment[]",
    boolean: "boolean",
    bool: "boolean",
    yesno: "boolean",
    truefalse: "boolean",
    passfail: "boolean",
    是否: "boolean",
    布尔: "boolean",
    通过失败: "boolean",
    date: "date",
    日期: "date",
    datetime: "datetime",
    timestamp: "datetime",
    时间: "datetime",
    日期时间: "datetime",
  };
  return aliases[normalized] ?? "text";
}

function resultSemanticRoleFromText(value: string | undefined): ResultSemanticRole | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
  if (!normalized) return undefined;
  const aliases: Record<string, ResultSemanticRole> = {
    identifier: "identifier",
    id: "identifier",
    key: "identifier",
    标识: "identifier",
    标识符: "identifier",
    编号: "identifier",
    design: "design",
    condition: "design",
    treatment: "design",
    设计: "design",
    条件: "design",
    处理: "design",
    group: "group",
    grouping: "group",
    分组: "group",
    组别: "group",
    label: "label",
    tag: "label",
    标签: "label",
    measurement: "measurement",
    value: "measurement",
    measure: "measurement",
    metric: "measurement",
    测量: "measurement",
    测量值: "measurement",
    数值: "measurement",
    指标: "measurement",
    qc: "qc",
    qualitycontrol: "qc",
    质控: "qc",
    质量控制: "qc",
    annotation: "annotation",
    note: "annotation",
    comment: "annotation",
    注释: "annotation",
    备注: "annotation",
    说明: "annotation",
  };
  return aliases[normalized];
}

export const protocolTableColumnIndex = (headers: string[], candidates: string[], fallback: number) => {
    const normalized = headers.map((header) => header.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ""));
    const index = normalized.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
    return index >= 0 ? index : fallback;
  };

export function projectProtocolDocument(document: ProtocolDocument) {
  const materialSection = document.sections.find((item) => item.key === "material");
  const stepSection = document.sections.find((item) => item.key === "steps");
  const resultSection = document.sections.find((item) => item.key === "result_templates");
  const consumptionSection = document.sections.find((item) => item.key === "consumption_rules");

  const materialTables = (materialSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table");
  const materials: ProtocolMaterial[] = [];
  const equipment: ProtocolMaterial[] = [];
  for (const block of materialTables) {
    const headers = block.rows[0] ?? [];
    const nameIndex = protocolTableColumnIndex(headers, ["name", "material", "reagent", "名称", "材料", "试剂", "设备"], 0);
    const unitIndex = protocolTableColumnIndex(headers, ["unit", "单位"], -1);
    const roleIndex = protocolTableColumnIndex(headers, ["role", "use", "用途", "作用"], -1);
    const notesIndex = protocolTableColumnIndex(headers, ["note", "setting", "amount", "备注", "条件", "用量"], -1);
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

  const { steps, commonBlocks, executionNeedsReview } = projectProtocolExecution(document);

  const resultTemplates: ResultTemplate[] = (resultSection?.blocks ?? [])
    .filter((block): block is Extract<ProtocolContentBlock, { type: "table" }> => block.type === "table" && block.rows.length > 1)
    .map((block, index) => {
      if (block.resultTemplate) return normalizeResultTemplate({ ...block.resultTemplate, result_type: block.caption || block.resultTemplate.result_type }, index);
      const headers = block.rows[0] ?? [];
      const fieldIndex = protocolTableColumnIndex(headers, ["fieldkey", "field", "name", "字段键", "字段", "名称"], 0);
      const labelIndex = protocolTableColumnIndex(headers, ["label", "displayname", "显示名", "标签"], -1);
      const typeIndex = protocolTableColumnIndex(headers, ["type", "类型"], 1);
      const unitIndex = protocolTableColumnIndex(headers, ["unit", "单位"], 2);
      const requiredIndex = protocolTableColumnIndex(headers, ["required", "必填"], 3);
      const roleIndex = protocolTableColumnIndex(headers, ["role", "semanticrole", "语义角色", "角色"], -1);
      const optionsIndex = protocolTableColumnIndex(headers, ["options", "选项"], -1);
      const minIndex = protocolTableColumnIndex(headers, ["min", "minimum", "最小值"], -1);
      const maxIndex = protocolTableColumnIndex(headers, ["max", "maximum", "最大值"], -1);
      const isLegacyFieldTable = labelIndex < 0 && roleIndex < 0 && optionsIndex < 0 && minIndex < 0 && maxIndex < 0;
      const fields = block.rows.slice(1).map((row) => {
        const dataType = resultFieldDataTypeFromText(row[typeIndex]);
        const key = row[fieldIndex]?.trim() ?? "";
        const label = labelIndex >= 0 ? row[labelIndex]?.trim() || key : key;
        const min = minIndex >= 0 && row[minIndex]?.trim() ? Number(row[minIndex]) : undefined;
        const max = maxIndex >= 0 && row[maxIndex]?.trim() ? Number(row[maxIndex]) : undefined;
        const semanticRole = roleIndex >= 0 ? resultSemanticRoleFromText(row[roleIndex]) : undefined;
        if (isLegacyFieldTable) return {
          name: label,
          type: dataType,
          unit: row[unitIndex]?.trim() || undefined,
          required: /^(yes|true|1|是|必填)$/i.test(row[requiredIndex]?.trim() ?? ""),
        };
        return {
          key,
          label,
          name: label,
          dataType,
          type: dataType,
          unit: row[unitIndex]?.trim() || undefined,
          required: /^(yes|true|1|是|必填)$/i.test(row[requiredIndex]?.trim() ?? ""),
          semanticRole,
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
      const materialIndex = protocolTableColumnIndex(headers, ["material", "name", "材料", "名称"], 0);
      const formulaIndex = protocolTableColumnIndex(headers, ["formula", "calculation", "公式", "计算"], 1);
      const unitIndex = protocolTableColumnIndex(headers, ["unit", "单位"], 2);
      const inventoryIndex = protocolTableColumnIndex(headers, ["requiresinventoryselection", "选择库存"], -1);
      return block.rows.slice(1).map((row) => ({ material_name: row[materialIndex] ?? "", formula: row[formulaIndex] ?? "", unit: row[unitIndex] ?? "",
        ...(inventoryIndex >= 0 && row[inventoryIndex]?.trim() ? { requires_inventory_selection: /^(true|yes|1|是)$/i.test(row[inventoryIndex].trim()) } : {}),
      }));
    })
    .filter((item) => item.material_name && item.formula);

  return {
    description: sectionPlainText(document, "description"),
    purpose: sectionPlainText(document, "purpose"),
    background: sectionPlainText(document, "background"),
    materials,
    equipment,
    steps,
    commonBlocks,
    executionNeedsReview,
    resultTemplates,
    consumptionRules,
  };
}

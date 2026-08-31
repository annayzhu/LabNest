import { experimentStatusValues, projectStatusValues, recordStatusValues } from "./status-options";

export const structuredModuleKeys = [
  "projects",
  "research-plans",
  "protocols",
  "experiments",
  "results",
  "inventory",
  "reports",
] as const;

export type StructuredModuleKey = (typeof structuredModuleKeys)[number];
export type StructuredFileFormat = "csv" | "tsv" | "xlsx" | "json" | "md" | "docx";

export type StructuredFieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  description?: string;
  example?: string | number | boolean;
  allowedValues?: readonly string[];
};

export type StructuredModuleDefinition = {
  key: StructuredModuleKey;
  singular: string;
  title: string;
  importFormats: StructuredFileFormat[];
  exportFormats: StructuredFileFormat[];
  fields: StructuredFieldDefinition[];
  markdownSections?: Array<{ field: string; title: string; aliases?: string[] }>;
};

export const structuredModules: Record<StructuredModuleKey, StructuredModuleDefinition> = {
  projects: {
    key: "projects",
    singular: "Project",
    title: "Projects",
    importFormats: ["csv", "xlsx", "json", "md"],
    exportFormats: ["csv", "xlsx", "json", "md"],
    fields: [
      { key: "name", label: "Project name", required: true, aliases: ["project", "projectName", "项目", "项目名称"], example: "Replace with Project name" },
      { key: "description", label: "Description", aliases: ["objective", "项目说明", "研究目的"] },
      {
        key: "status",
        label: "Status",
        aliases: ["项目状态"],
        example: "active",
        description: "Choose one of the controlled Project status values.",
        allowedValues: projectStatusValues,
      },
      { key: "tags", label: "Tags", aliases: ["tag", "标签"], description: "Semicolon- or comma-separated values." },
    ],
    markdownSections: [{ field: "description", title: "Description" }],
  },
  "research-plans": {
    key: "research-plans",
    singular: "Research Plan",
    title: "Research Plans",
    importFormats: ["xlsx", "json", "md", "docx"],
    exportFormats: ["xlsx", "json", "md"],
    fields: [
      { key: "project", label: "Project", required: true, aliases: ["projectId", "projectName", "项目", "项目名称"] },
      { key: "code", label: "Plan code", aliases: ["planCode", "researchPlanCode", "研究方案编号"], example: "RP-001" },
      { key: "title", label: "Title", required: true, aliases: ["researchPlan", "planTitle", "研究方案", "标题"], example: "Replace with Research Plan title" },
      { key: "objective", label: "Objective", aliases: ["purpose", "研究目的"] },
      { key: "hypothesis", label: "Hypothesis", aliases: ["研究假设"] },
      { key: "rationale", label: "Rationale", aliases: ["依据", "研究依据"] },
      { key: "design", label: "Design", aliases: ["researchDesign", "研究设计"] },
      { key: "status", label: "Status", example: "draft" },
      { key: "tags", label: "Tags", aliases: ["tag", "标签"] },
      { key: "protocolCodes", label: "Protocol codes", aliases: ["protocols", "关联实验规程"], description: "Semicolon-separated PRT codes." },
      { key: "primaryProtocolCode", label: "Primary Protocol code", aliases: ["primaryProtocol", "主要实验规程"] },
      {
        key: "materialMethods",
        label: "Material & methods",
        aliases: ["materials", "methods", "material and methods", "variables", "Variables & controls", "材料与方法"],
      },
      { key: "acceptanceCriteria", label: "Acceptance criteria" },
      { key: "constraints", label: "Constraints & dependencies" },
      { key: "references", label: "References & working notes" },
    ],
    markdownSections: [
      { field: "objective", title: "Objective" },
      { field: "hypothesis", title: "Hypothesis" },
      { field: "rationale", title: "Rationale" },
      { field: "design", title: "Design" },
      { field: "materialMethods", title: "Material & methods", aliases: ["Variables & controls"] },
      { field: "acceptanceCriteria", title: "Acceptance criteria" },
      { field: "constraints", title: "Constraints & dependencies" },
      { field: "references", title: "References & working notes" },
    ],
  },
  protocols: {
    key: "protocols",
    singular: "Protocol",
    title: "Protocols",
    importFormats: ["json", "md", "docx"],
    exportFormats: ["xlsx", "json", "md"],
    fields: [
      { key: "humanCode", label: "Protocol code", aliases: ["protocolId", "code", "实验规程编号"] },
      { key: "canonicalTitle", label: "Protocol title", required: true, aliases: ["title", "protocolTitle", "实验规程标题"], example: "Replace with Protocol title" },
      { key: "shortTitle", label: "Short title" },
      { key: "englishTitle", label: "English title" },
      { key: "scope", label: "Scope", example: "general" },
      { key: "project", label: "Project", aliases: ["projectId", "projectName", "项目"] },
      { key: "researchPlanCodes", label: "Research Plan codes", aliases: ["researchPlans", "关联研究方案"] },
      { key: "primaryResearchPlanCodes", label: "Primary Research Plan codes", aliases: ["primaryResearchPlans", "主要研究方案"] },
      { key: "availability", label: "Availability", aliases: ["status"], example: "draft" },
      { key: "reviewStage", label: "Review stage", aliases: ["review", "审核阶段"], example: "draft" },
      { key: "displayVersion", label: "Version", aliases: ["version"], example: "0.1" },
      { key: "tags", label: "Tags", aliases: ["tag", "标签"] },
      { key: "description", label: "Description" },
      { key: "purpose", label: "Purpose" },
      { key: "background", label: "Background" },
      { key: "material", label: "Material", aliases: ["materials"] },
      { key: "steps", label: "Steps" },
      { key: "resultTemplates", label: "Result Templates" },
      { key: "consumptionRules", label: "Consumption Rules" },
      { key: "contentJson", label: "Structured document JSON" },
    ],
    markdownSections: [
      { field: "description", title: "Description" },
      { field: "purpose", title: "Purpose" },
      { field: "background", title: "Background" },
      { field: "material", title: "Material" },
      { field: "steps", title: "Steps" },
      { field: "resultTemplates", title: "Result Templates" },
      { field: "consumptionRules", title: "Consumption Rules" },
    ],
  },
  experiments: {
    key: "experiments",
    singular: "Experiment",
    title: "Experiments",
    importFormats: ["csv", "xlsx", "json", "md"],
    exportFormats: ["csv", "xlsx", "json", "md"],
    fields: [
      { key: "project", label: "Project", aliases: ["projectId", "projectName", "项目"] },
      { key: "researchPlan", label: "Research Plan", required: true, aliases: ["researchPlanId", "plan", "planCode", "研究方案"] },
      { key: "runCode", label: "Run code", aliases: ["experimentCode", "实验编号"], example: "EXP-001" },
      { key: "title", label: "Title", required: true, aliases: ["experiment", "experimentTitle", "实验标题"], example: "Replace with Experiment title" },
      { key: "date", label: "Date", required: true, aliases: ["experimentDate", "实验日期"], example: "2026-08-09" },
      {
        key: "status",
        label: "Execution status",
        example: "planned",
        description: "Choose one of the controlled Experiment execution states.",
        allowedValues: experimentStatusValues,
      },
      {
        key: "recordStatus",
        label: "Record status",
        example: "draft",
        description: "Choose one of the controlled record lifecycle states.",
        allowedValues: recordStatusValues,
      },
      { key: "primaryProtocolCode", label: "First Protocol code", aliases: ["protocol", "protocolCode", "primaryProtocolCode", "主要实验规程"], description: "Optional. Leave blank for a fully custom Experiment." },
      { key: "protocolVersion", label: "Protocol version", example: "0.1" },
      { key: "supportingProtocolCodes", label: "Supporting Protocol codes" },
      { key: "purpose", label: "Purpose" },
      // Everything below lands in a section of the Experiment document; the
      // Experiment table keeps no per-section narrative columns.
      { key: "background", label: "Background & rationale" },
      { key: "materials", label: "Setup & samples" },
      { key: "steps", label: "Execution notes" },
      { key: "observations", label: "Observations" },
      { key: "deviations", label: "Deviations" },
      { key: "conclusion", label: "Summary & conclusion", aliases: ["resultSummary", "result summary", "结论"] },
      { key: "tags", label: "Tags" },
    ],
    markdownSections: [
      { field: "purpose", title: "Purpose" },
      { field: "background", title: "Background & rationale" },
      { field: "materials", title: "Setup & samples", aliases: ["Materials"] },
      { field: "steps", title: "Execution notes", aliases: ["Steps"] },
      { field: "observations", title: "Observations" },
      { field: "deviations", title: "Deviations" },
      { field: "conclusion", title: "Summary & conclusion", aliases: ["Result summary", "Conclusion"] },
    ],
  },
  results: {
    key: "results",
    singular: "Result",
    title: "Results",
    importFormats: ["csv", "tsv", "xlsx", "json"],
    exportFormats: ["csv", "xlsx", "json"],
    fields: [
      { key: "experiment", label: "Experiment", required: true, aliases: ["experimentId", "runCode", "实验"] },
      { key: "title", label: "Title", required: true, aliases: ["result", "resultTitle", "结果标题"], example: "Replace with Result title" },
      { key: "resultType", label: "Result type", required: true, aliases: ["type", "结果类型"], example: "measurement" },
      { key: "templateKey", label: "Result Template key", aliases: ["template", "template_key"] },
      { key: "templateInstanceKey", label: "Template instance key" },
      { key: "templateInstanceLabel", label: "Template instance label" },
      { key: "templateValuesJson", label: "Template values JSON", description: "JSON object keyed by stable Result Template field keys." },
      { key: "templateSnapshotJson", label: "Template snapshot JSON", description: "Frozen Result Template schema; use JSON export for nested structures." },
      { key: "validationStatus", label: "Template validation status" },
      { key: "recordStatus", label: "Record status", example: "draft" },
      { key: "sourceType", label: "Source type", example: "file_import" },
      { key: "qualityStatus", label: "Quality status", aliases: ["qc", "quality"], example: "not_assessed" },
      { key: "textValue", label: "Text value" },
      { key: "numericValue", label: "Numeric value" },
      { key: "unit", label: "Unit" },
      { key: "analysisMethod", label: "Analysis method" },
      { key: "notes", label: "Notes" },
      { key: "summary", label: "Summary" },
      { key: "analysis", label: "Analysis" },
      { key: "interpretation", label: "Interpretation" },
      { key: "qualityLimitations", label: "Deviations & limitations" },
    ],
  },
  inventory: {
    key: "inventory",
    singular: "Inventory Item",
    title: "Inventory",
    importFormats: ["csv", "xlsx", "json"],
    exportFormats: ["csv", "xlsx", "json"],
    fields: [
      { key: "name", label: "Item name", required: true, aliases: ["item", "物料", "名称"], example: "Replace with item name" },
      { key: "englishName", label: "English name", aliases: ["英文名"] },
      { key: "category", label: "Category", aliases: ["materialType", "物料类型", "分类"], example: "reagent" },
      { key: "brand", label: "Brand", aliases: ["品牌"] },
      { key: "principalInvestigator", label: "Principal investigator (PI)", aliases: ["PI", "principalInvestigator", "课题负责人", "负责人", "所属PI"] },
      { key: "containerType", label: "Container type" },
      { key: "barcode", label: "Barcode" },
      { key: "aliquotCode", label: "Aliquot code" },
      { key: "lotNumber", label: "Lot number", aliases: ["lot", "批号"] },
      { key: "vendor", label: "Vendor" },
      { key: "catalogNumber", label: "Catalog number" },
      { key: "casNumber", label: "CAS number", aliases: ["CAS", "CAS号"] },
      { key: "currentQuantity", label: "Initial quantity", required: true, aliases: ["quantity", "数量"], example: 0 },
      { key: "unit", label: "Unit", required: true, aliases: ["单位"], example: "µL" },
      { key: "lowThreshold", label: "Safety stock", aliases: ["reorderPoint", "安全库存", "最低库存"], example: 10 },
      { key: "concentration", label: "Concentration" },
      { key: "location", label: "Location", aliases: ["locationName", "位置"] },
      { key: "positionCode", label: "Position" },
      { key: "expiryDate", label: "Expiry date" },
      { key: "storageCondition", label: "Storage condition" },
      { key: "freezeThawCount", label: "Freeze-thaw count", example: 0 },
      { key: "status", label: "Status", example: "active" },
      { key: "notes", label: "Notes" },
    ],
  },
  reports: {
    key: "reports",
    singular: "Report",
    title: "Reports",
    importFormats: ["json", "md", "docx"],
    exportFormats: ["xlsx", "json", "md"],
    fields: [
      { key: "project", label: "Project", required: true, aliases: ["projectId", "projectName", "项目"] },
      { key: "researchPlan", label: "Research Plan", aliases: ["researchPlanId", "plan", "研究方案"] },
      { key: "title", label: "Title", required: true, aliases: ["report", "reportTitle", "报告标题"], example: "Replace with Report title" },
      { key: "status", label: "Status", example: "draft" },
      { key: "periodStart", label: "Period start" },
      { key: "periodEnd", label: "Period end" },
      { key: "tags", label: "Tags" },
      { key: "executiveSummary", label: "Executive summary" },
      { key: "researchQuestion", label: "Research question & design" },
      { key: "methods", label: "Methods & execution" },
      { key: "results", label: "Results & evidence" },
      { key: "interpretation", label: "Interpretation" },
      { key: "limitationsNextSteps", label: "Limitations & next steps" },
    ],
    markdownSections: [
      { field: "executiveSummary", title: "Executive summary" },
      { field: "researchQuestion", title: "Research question & design" },
      { field: "methods", title: "Methods & execution" },
      { field: "results", title: "Results & evidence" },
      { field: "interpretation", title: "Interpretation" },
      { field: "limitationsNextSteps", title: "Limitations & next steps" },
    ],
  },
};

export function isStructuredModuleKey(value: string): value is StructuredModuleKey {
  return structuredModuleKeys.includes(value as StructuredModuleKey);
}

export function formatLabel(format: StructuredFileFormat) {
  return format === "md" ? "Markdown" : format.toUpperCase();
}

export function formatFromFilename(filename: string): StructuredFileFormat | undefined {
  const extension = filename.toLowerCase().split(".").pop();
  return extension && ["csv", "tsv", "xlsx", "json", "md", "docx"].includes(extension)
    ? extension as StructuredFileFormat
    : undefined;
}

import type {
  ProcurementInquiry,
  ProcurementQuoteLine,
  ProcurementQuoteLineStatus,
  PurchaseRequest,
  SchoolSelfPurchaseRow,
} from "./types";

export const schoolSelfPurchaseHeaders: (keyof SchoolSelfPurchaseRow)[] = [
  "产品分类*",
  "商品名称*",
  "CAS号",
  "规格",
  "数量*",
  "包装单位*",
  "未税金额(元)*",
  "税额(元)*",
  "未税单价(元)",
  "特殊购买情况说明",
  "容量",
  "容量单位",
];

export const schoolProductCategories = ["化学试剂", "生物试剂", "实验材料", "办公耗材"] as const;

export const schoolPackageUnits = [
  "箱",
  "片",
  "对",
  "个",
  "支",
  "包",
  "张",
  "盒",
  "袋",
  "瓶",
  "桶",
  "台",
  "套",
  "卷",
  "块",
  "bp",
  "BL",
  "EA",
  "EG",
  "na",
  "吨",
  "双",
  "只",
  "KG",
  "g",
  "批",
  "件",
  "万张",
  "毫克",
  "毫升",
] as const;

export const schoolCapacityUnits = ["g", "kg", "ml", "L", "mg", "ug", "ul", "μL", "μg"] as const;

const selectedStatuses = new Set<ProcurementQuoteLineStatus>(["selected", "converted"]);

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isQuoteLineSelected(line: ProcurementQuoteLine): boolean {
  return selectedStatuses.has(line.status);
}

export function getQuoteLineAmountExclTax(line: ProcurementQuoteLine): number {
  if (line.amountExclTax !== undefined) return roundCurrency(line.amountExclTax);
  if (line.unitPriceExclTax !== undefined) return roundCurrency(line.unitPriceExclTax * line.quantity);
  return 0;
}

export function getQuoteLineTaxAmount(line: ProcurementQuoteLine): number {
  if (line.taxAmount !== undefined) return roundCurrency(line.taxAmount);
  if (line.taxRate !== undefined) return roundCurrency(getQuoteLineAmountExclTax(line) * line.taxRate);
  return 0;
}

export function getQuoteLineAmountInclTax(line: ProcurementQuoteLine): number {
  if (line.amountInclTax !== undefined) return roundCurrency(line.amountInclTax);
  return roundCurrency(getQuoteLineAmountExclTax(line) + getQuoteLineTaxAmount(line));
}

export function getInquirySummary(inquiry: ProcurementInquiry, quoteLines: ProcurementQuoteLine[]) {
  const rows = quoteLines.filter((line) => line.inquiryId === inquiry.id);
  const selectedRows = rows.filter(isQuoteLineSelected);
  const suppliers = new Set(rows.map((line) => line.supplierName).filter(Boolean));
  const selectedSuppliers = new Set(selectedRows.map((line) => line.supplierName).filter(Boolean));

  return {
    rowCount: rows.length,
    selectedCount: selectedRows.length,
    supplierCount: suppliers.size,
    selectedSupplierCount: selectedSuppliers.size,
    selectedAmountInclTax: roundCurrency(selectedRows.reduce((sum, line) => sum + getQuoteLineAmountInclTax(line), 0)),
  };
}

export function groupSelectedQuoteLinesBySupplier(lines: ProcurementQuoteLine[]) {
  const groups = new Map<string, ProcurementQuoteLine[]>();

  for (const line of lines.filter(isQuoteLineSelected)) {
    const supplierName = line.supplierName ?? "Unknown supplier";
    groups.set(supplierName, [...(groups.get(supplierName) ?? []), line]);
  }

  return Array.from(groups.entries())
    .map(([supplierName, quoteLines]) => ({ supplierName, quoteLines }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export function toSchoolSelfPurchaseRow(line: ProcurementQuoteLine): SchoolSelfPurchaseRow {
  const amountExclTax = getQuoteLineAmountExclTax(line);

  return {
    "产品分类*": line.productCategory ?? "",
    "商品名称*": line.productName,
    CAS号: line.casNumber ?? "",
    规格: line.specification ?? "",
    "数量*": line.quantity,
    "包装单位*": line.packageUnit,
    "未税金额(元)*": amountExclTax,
    "税额(元)*": getQuoteLineTaxAmount(line),
    "未税单价(元)": line.unitPriceExclTax ?? (line.quantity > 0 ? roundCurrency(amountExclTax / line.quantity) : 0),
    特殊购买情况说明: line.specialPurchaseNote ?? "",
    容量: line.capacity ?? "",
    容量单位: line.capacityUnit ?? "",
  };
}

export function toSchoolSelfPurchaseRows(lines: ProcurementQuoteLine[]): SchoolSelfPurchaseRow[] {
  return lines.filter(isQuoteLineSelected).map(toSchoolSelfPurchaseRow);
}

export function validateSchoolSelfPurchaseRow(row: SchoolSelfPurchaseRow): string[] {
  const issues: string[] = [];

  if (!row["产品分类*"]) issues.push("产品分类 is required.");
  if (!row["商品名称*"]) issues.push("商品名称 is required.");
  if (!Number.isFinite(row["数量*"]) || row["数量*"] <= 0) issues.push("数量 must be a positive number.");
  if (!row["包装单位*"]) issues.push("包装单位 is required.");
  if (!Number.isFinite(row["未税金额(元)*"])) issues.push("未税金额 must be numeric.");
  if (!Number.isFinite(row["税额(元)*"])) issues.push("税额 must be numeric.");

  if (row["产品分类*"] === "化学试剂") {
    if (!row.CAS号) issues.push("CAS号 is required for 化学试剂.");
    if (row.容量 === "" || !Number.isFinite(row.容量)) issues.push("容量 is required for 化学试剂.");
    if (!row.容量单位) issues.push("容量单位 is required for 化学试剂.");
  }

  return issues;
}

export function createPurchaseRequestFromQuoteLine(line: ProcurementQuoteLine): PurchaseRequest {
  if (!isQuoteLineSelected(line)) {
    throw new Error("Only selected quote lines can become purchase requests.");
  }

  return {
    id: `purchase-${line.id.replace(/^quote-/, "")}`,
    title: line.productName,
    status: "planned",
    vendor: line.supplierName,
    catalogNumber: line.catalogNumber,
    procurementQuoteLineId: line.id,
    quantity: line.quantity,
    unit: line.packageUnit,
    price: getQuoteLineAmountInclTax(line),
    notes: line.decisionReason,
  };
}

import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { schoolSelfPurchaseHeaders } from "./procurement";
import type { SchoolSelfPurchaseRow } from "./types";

type WorkbookInput = string | Buffer;

function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function toText(value: unknown): string {
  return isBlankCell(value) ? "" : String(value).trim();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(toText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: unknown): number | "" {
  if (isBlankCell(value)) return "";
  return toNumber(value);
}

function headerText(value: unknown): string {
  return toText(value).replace(/\s+/g, "");
}

function findHeaderRow(sheetRows: unknown[][]): { index: number; map: Map<keyof SchoolSelfPurchaseRow, number> } {
  for (const [index, row] of sheetRows.entries()) {
    const normalizedCells = row.map(headerText);
    const map = new Map<keyof SchoolSelfPurchaseRow, number>();

    for (const header of schoolSelfPurchaseHeaders) {
      const columnIndex = normalizedCells.indexOf(headerText(header));
      if (columnIndex >= 0) map.set(header, columnIndex);
    }

    if (map.has("产品分类*") && map.has("商品名称*") && map.has("数量*")) {
      return { index, map };
    }
  }

  throw new Error("Could not find a school self-purchase header row in the workbook.");
}

export async function readSchoolSelfPurchaseWorkbook(input: WorkbookInput): Promise<SchoolSelfPurchaseRow[]> {
  const sheetRows = (await readSheet(input, { trim: true })) as unknown[][];
  const { index: headerRowIndex, map } = findHeaderRow(sheetRows);

  return sheetRows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => !isBlankCell(cell)))
    .map((row) => ({
      "产品分类*": toText(row[map.get("产品分类*") ?? -1]),
      "商品名称*": toText(row[map.get("商品名称*") ?? -1]),
      CAS号: toText(row[map.get("CAS号") ?? -1]),
      规格: toText(row[map.get("规格") ?? -1]),
      "数量*": toNumber(row[map.get("数量*") ?? -1]),
      "包装单位*": toText(row[map.get("包装单位*") ?? -1]),
      "未税金额(元)*": toNumber(row[map.get("未税金额(元)*") ?? -1]),
      "税额(元)*": toNumber(row[map.get("税额(元)*") ?? -1]),
      "未税单价(元)": toNumber(row[map.get("未税单价(元)") ?? -1]),
      特殊购买情况说明: toText(row[map.get("特殊购买情况说明") ?? -1]),
      容量: toOptionalNumber(row[map.get("容量") ?? -1]),
      容量单位: toText(row[map.get("容量单位") ?? -1]),
    }));
}

function excelValue(value: SchoolSelfPurchaseRow[keyof SchoolSelfPurchaseRow]) {
  return value === "" ? null : value;
}

export async function writeSchoolSelfPurchaseWorkbook(rows: SchoolSelfPurchaseRow[]): Promise<Buffer> {
  const data: SheetData = [
    schoolSelfPurchaseHeaders.map((header) => ({
      value: header,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#ece7dc",
      align: "center",
      wrap: true,
    })),
    ...rows.map((row) => schoolSelfPurchaseHeaders.map((header) => excelValue(row[header]))),
  ];

  const instructions: SheetData = [
    [{ value: "使用说明", type: String, fontWeight: "bold" }],
    ["* 字段为学校自购备案模板必填字段。"],
    ["化学试剂建议填写标准化学名称、CAS号、容量和容量单位。"],
    ["LabNest 仅导出已选中的报价行；未采购报价保留在询价记录中。"],
  ];

  return writeXlsxFile(
    [
      {
        sheet: "导入",
        data,
        columns: [
          { width: 14 },
          { width: 26 },
          { width: 16 },
          { width: 18 },
          { width: 10 },
          { width: 12 },
          { width: 16 },
          { width: 14 },
          { width: 16 },
          { width: 26 },
          { width: 10 },
          { width: 12 },
        ],
      },
      {
        sheet: "使用说明",
        data: instructions,
        columns: [{ width: 64 }],
      },
    ],
    { fontFamily: "Arial", fontSize: 11 },
  ).toBuffer();
}

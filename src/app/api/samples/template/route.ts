import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { getCellAddress, getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings, sanitizeAttributeValue } from "write-excel-file/utility";
import { prisma } from "@/lib/db";
import { localeCookieName, zhUi } from "@/lib/i18n";
import { biosafetyLevels, MAX_SAMPLE_BATCH, sampleColumns, type SampleColumnKey } from "@/lib/samples";
import { sampleLocationOptions, sampleTypes } from "@/lib/samples.server";

export const runtime = "nodejs";

const zhHeaders: Record<SampleColumnKey, string> = {
  code: "编号", name: "名称", type: "类型", origin: "来源", parent: "母样本", box: "盒子", position: "位置", amount: "体积", amountUnit: "体积单位",
  concentration: "浓度", concentrationUnit: "浓度单位", collectedAt: "日期", biosafetyLevel: "生物安全等级", notes: "备注",
};
const order: SampleColumnKey[] = ["name", "code", "type", "origin", "parent", "box", "position", "amount", "amountUnit", "concentration", "concentrationUnit", "collectedAt", "biosafetyLevel", "notes"];

/** The sample import template (S8): bilingual headers the table reads back, and drop-downs for type, box and biosafety level. */
export async function GET(request: Request) {
  const zh = new RegExp(`(?:^|;\\s*)${localeCookieName}=zh(?:;|$)`).test(request.headers.get("cookie") ?? "");
  const [types, locations] = await Promise.all([sampleTypes(prisma), sampleLocationOptions(prisma)]);
  const typeNames = types.map((type) => (zh ? zhUi[type.label] ?? type.label : type.label));
  const lists: Array<{ column: SampleColumnKey; values: string[] }> = [
    { column: "type", values: typeNames },
    { column: "box", values: locations.map((location) => location.label) },
    { column: "biosafetyLevel", values: [...biosafetyLevels] },
  ];
  const header = (key: SampleColumnKey) => `${sampleColumns.find((column) => column.key === key)!.label} (${zhHeaders[key]})`;
  const data: SheetData = [order.map((key) => ({ value: header(key), type: String, fontWeight: "bold" as const, backgroundColor: "#DDE8EA", wrap: true }))];
  const longest = Math.max(1, ...lists.map((list) => list.values.length));
  const listSheet: SheetData = [
    lists.map((list) => ({ value: header(list.column), type: String, fontWeight: "bold" as const })),
    ...Array.from({ length: longest }, (_, row) => lists.map((list) => list.values[row] ?? "")),
  ];
  const instructions: SheetData = [
    [{ value: zh ? "样本导入" : "Sample import", type: String, fontWeight: "bold" }],
    [zh ? "第一行的列名不要改，每行一个样本，最多 500 行。名称和类型必填；编号留空时按类型前缀自动生成。" : `Keep the header row. One sample per row, at most ${MAX_SAMPLE_BATCH}. Name and type are required; an empty code is generated from the type's prefix.`],
    [zh ? "类型、盒子和生物安全等级可以从下拉中选择。位置写成 A1；盒子没有行列规格时可写任意文字。" : "Choose type, box and biosafety level from the drop-downs. Positions read like A1; a box without rows and columns takes any text."],
    [zh ? "体积和浓度可以连同单位一起写，例如 50 µL、199.6 ng/µL；没写单位时用类型的默认单位。" : "Amounts and concentrations may carry their unit, e.g. 50 µL or 199.6 ng/µL; without one the type's default unit is used."],
    [zh ? "日期写成 2026-10-31。母样本填它的编号。" : "Dates read like 2026-10-31. A parent sample is given by its code."],
  ];
  const validation = {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(xml: string, _options: unknown, { sheetIndex }: { sheetIndex: number }) {
            if (sheetIndex !== 0) return xml;
            const rules = lists.filter((list) => list.values.length).map((list, listIndex) => {
              const column = order.indexOf(list.column);
              const letter = getCellAddress(1, listIndex).replace(/\d+$/, "");
              return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="warning" sqref="${getCellAddress(2, column)}:${getCellAddress(MAX_SAMPLE_BATCH + 1, column)}" errorTitle="${sanitizeAttributeValue(header(list.column))}" error="${sanitizeAttributeValue(zh ? "请从下拉列表中选择" : "Choose from the list")}"><formula1>Lists!$${letter}$2:$${letter}$${list.values.length + 1}</formula1></dataValidation>`;
            });
            if (!rules.length) return xml;
            return insertElementMarkupAccordingToOrderOfSiblings(xml, `<dataValidations count="${rules.length}">${rules.join("")}</dataValidations>`, getOrderOfSiblings("xl/worksheets/sheet{id}.xml", "worksheet") ?? [], "worksheet");
          },
        },
      },
    },
  };
  const buffer = await writeXlsxFile([
    { sheet: "Samples", data, columns: order.map((key) => ({ width: key === "notes" || key === "box" ? 32 : 18 })) },
    { sheet: "Lists", data: listSheet, columns: lists.map(() => ({ width: 36 })) },
    { sheet: "Instructions", data: instructions, columns: [{ width: 120 }] },
  ], { fontFamily: "Arial", fontSize: 10, features: [validation] }).toBuffer();
  return new Response(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zh ? "LabNest_样本导入模板.xlsx" : "LabNest_Sample_Import_Template.xlsx")}`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

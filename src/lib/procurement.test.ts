import { describe, expect, it } from "vitest";
import {
  createPurchaseRequestFromQuoteLine,
  getInquirySummary,
  groupSelectedQuoteLinesBySupplier,
  toSchoolSelfPurchaseRows,
  validateSchoolSelfPurchaseRow,
} from "./procurement";
import { readSchoolSelfPurchaseWorkbook, writeSchoolSelfPurchaseWorkbook } from "./procurement-excel";
import type { ProcurementInquiry, ProcurementQuoteLine } from "./types";

const inquiry: ProcurementInquiry = {
  id: "inq-1",
  title: "July reagent inquiry",
  status: "selected",
  sourceType: "excel",
  importedFileName: "July-reagents.xlsx",
  supplierScope: "multi_supplier",
  quoteLineIds: ["quote-selected", "quote-rejected"],
  createdAt: "2026-07-08T00:00:00+08:00",
};

const selectedLine: ProcurementQuoteLine = {
  id: "quote-selected",
  inquiryId: "inq-1",
  status: "selected",
  supplierName: "Bio-Rad",
  productCategory: "化学试剂",
  productName: "Agarose",
  casNumber: "9012-36-6",
  specification: "100 g",
  quantity: 1,
  packageUnit: "瓶",
  amountExclTax: 88,
  taxAmount: 11.44,
  unitPriceExclTax: 88,
  capacity: 100,
  capacityUnit: "g",
  catalogNumber: "1613100",
  decisionReason: "Selected for existing supplier reliability.",
};

const rejectedLine: ProcurementQuoteLine = {
  ...selectedLine,
  id: "quote-rejected",
  status: "not_selected",
  supplierName: "Supplier B",
  amountExclTax: 120,
  taxAmount: 15.6,
  unitPriceExclTax: 120,
  decisionReason: "Higher price for the same specification.",
};

describe("procurement inquiry workflow", () => {
  it("keeps unselected quote lines out of school import rows", () => {
    const rows = toSchoolSelfPurchaseRows([selectedLine, rejectedLine]);

    expect(rows).toHaveLength(1);
    expect(rows[0]["商品名称*"]).toBe("Agarose");
    expect(rows[0]["未税金额(元)*"]).toBe(88);
    expect(rows[0]["税额(元)*"]).toBe(11.44);
  });

  it("summarizes selected value while retaining all quote rows", () => {
    const summary = getInquirySummary(inquiry, [selectedLine, rejectedLine]);

    expect(summary.rowCount).toBe(2);
    expect(summary.selectedCount).toBe(1);
    expect(summary.supplierCount).toBe(2);
    expect(summary.selectedAmountInclTax).toBe(99.44);
  });

  it("groups selected rows by supplier because the school import accepts one supplier at a time", () => {
    const selectedLine2 = { ...selectedLine, id: "quote-selected-2", supplierName: "Macklin" };
    const groups = groupSelectedQuoteLinesBySupplier([selectedLine, selectedLine2, rejectedLine]);

    expect(groups.map((group) => group.supplierName)).toEqual(["Bio-Rad", "Macklin"]);
    expect(groups.every((group) => group.quoteLines.length === 1)).toBe(true);
  });

  it("validates school chemical reagent requirements", () => {
    const [row] = toSchoolSelfPurchaseRows([{ ...selectedLine, casNumber: undefined, capacity: undefined }]);

    expect(validateSchoolSelfPurchaseRow(row)).toEqual([
      "CAS号 is required for 化学试剂.",
      "容量 is required for 化学试剂.",
    ]);
  });

  it("converts only selected quote lines into purchase requests", () => {
    const purchase = createPurchaseRequestFromQuoteLine(selectedLine);

    expect(purchase.procurementQuoteLineId).toBe("quote-selected");
    expect(purchase.price).toBe(99.44);
    expect(() => createPurchaseRequestFromQuoteLine(rejectedLine)).toThrow("Only selected quote lines");
  });

  it("round-trips the school self-purchase workbook shape", async () => {
    const rows = toSchoolSelfPurchaseRows([selectedLine]);
    const workbook = await writeSchoolSelfPurchaseWorkbook(rows);
    const parsedRows = await readSchoolSelfPurchaseWorkbook(workbook);

    expect(parsedRows).toEqual(rows);
  });
});

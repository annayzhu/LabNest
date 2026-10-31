import { describe, expect, it } from "vitest";
import { columnPrompt, parseColumnReply } from "./column-suggestion";

const fields = [
  { key: "name", label: "Item name" },
  { key: "catalogNumber", label: "Catalog number" },
  { key: "currentQuantity", label: "Initial quantity" },
  { key: "unit", label: "Unit", allowedValues: undefined },
];

describe("columnPrompt", () => {
  it("shows the model each field and each unrecognised column with a few of its values", () => {
    const prompt = columnPrompt(fields, [{ source: "货号/Cat.No", samples: ["S2002", "74104"] }]);
    expect(prompt.user).toContain("catalogNumber: Catalog number");
    expect(prompt.user).toContain('"货号/Cat.No": S2002 | 74104');
  });
});

describe("parseColumnReply", () => {
  it("keeps known fields for the columns asked about, one column per field", () => {
    const reply = 'Sure.\n{"货号/Cat.No": "catalogNumber", "订购数量": "currentQuantity", "备注": null, "规格": "catalogNumber", "Made up": "price", "Other column": "name"}';
    expect(parseColumnReply(reply, fields.map((field) => field.key), ["货号/Cat.No", "订购数量", "备注", "规格", "Made up"])).toEqual({ "货号/Cat.No": "catalogNumber", "订购数量": "currentQuantity" });
  });

  it("returns nothing for an answer that is not JSON", () => {
    expect(parseColumnReply("I cannot tell.", ["name"], ["A"])).toEqual({});
  });
});

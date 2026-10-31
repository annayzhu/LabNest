import { describe, expect, it } from "vitest";
import { draftRecords, parseDocumentReply, purchaseLine } from "./inventory-recognition";

describe("parseDocumentReply", () => {
  it("reads the supplier, the invoice number and every line with a name", () => {
    const reply = "Here is what I read:\n```json\n" + JSON.stringify({
      supplier: "Sigma-Aldrich", invoiceNumber: "INV-2026-118",
      items: [
        { name: "Sodium azide", brand: "Sigma", catalogNumber: "S2002", packSize: "100 g", quantity: 2, unit: "瓶", lotNumber: "MKCQ1234", expiryDate: "2027/06" },
        { name: "", catalogNumber: "X1" },
        { name: "Anti-CD3", quantity: "1", unit: "μL", expiryDate: "not printed" },
      ],
    }) + "\n```";
    expect(parseDocumentReply(reply)).toEqual({
      supplier: "Sigma-Aldrich", invoiceNumber: "INV-2026-118",
      rows: [
        { name: "Sodium azide", brand: "Sigma", catalogNumber: "S2002", packSize: "100 g", quantity: "2", unit: "bottle", lotNumber: "MKCQ1234", expiryDate: "2027-06-30" },
        { name: "Anti-CD3", brand: "", catalogNumber: "", packSize: "", quantity: "1", unit: "µL", lotNumber: "", expiryDate: "" },
      ],
    });
  });

  it("says so when the reply holds no readable list", () => {
    expect(() => parseDocumentReply("Sorry, the picture is too blurry.")).toThrow("The model did not return a list of items.");
  });
});

describe("draftRecords", () => {
  it("makes arrival rows for the inventory import, keeping the chosen product and the pack size", () => {
    const records = draftRecords([
      { name: "Sodium azide", brand: "", catalogNumber: "S2002", packSize: "100 g", quantity: "2", unit: "bottle", lotNumber: "MKCQ1234", expiryDate: "2027-06-30", location: "Reagent shelf 2", productId: "p_azide" },
    ], { supplier: "Sigma-Aldrich" });
    expect(records).toEqual([{
      name: "Sodium azide", brand: "", catalogNumber: "S2002", vendor: "Sigma-Aldrich", lotNumber: "MKCQ1234", expiryDate: "2027-06-30",
      currentQuantity: 2, unit: "bottle", location: "Reagent shelf 2", productId: "p_azide", importMode: "arrival", managementMode: "precise", notes: "Pack size: 100 g",
    }]);
  });
});

describe("purchaseLine", () => {
  const line = (name: string, catalogNumber = "") => ({ name, brand: "", catalogNumber, packSize: "", quantity: "1", unit: "box", lotNumber: "", expiryDate: "" });

  it("picks the invoice line with the purchase's catalogue number, else its name, else the only line", () => {
    expect(purchaseLine([line("Tips"), line("RNeasy kit", "74-104")], { title: "RNeasy Mini Kit", catalogNumber: "74104" })?.name).toBe("RNeasy kit");
    expect(purchaseLine([line("Tips"), line("PBS 10X")], { title: "pbs 10x", catalogNumber: null })?.name).toBe("PBS 10X");
    expect(purchaseLine([line("Tips")], { title: "Gloves", catalogNumber: null })?.name).toBe("Tips");
    expect(purchaseLine([line("Tips"), line("Tubes")], { title: "Gloves", catalogNumber: null })).toBeUndefined();
  });
});

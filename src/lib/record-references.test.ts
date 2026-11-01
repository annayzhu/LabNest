import { describe, expect, it } from "vitest";
import {
  lotReferenceLabel, parseRecordReferenceHref, parseRecordReferenceLink, recordReferenceMarkdown, recordReferencesInText, sampleReferenceLabel, stripRecordReferenceLinks,
} from "./record-references";

describe("sample and stock references", () => {
  it("knows a record page from the other inventory pages", () => {
    expect(parseRecordReferenceHref("/samples/smp_1")).toEqual({ kind: "sample", id: "smp_1" });
    expect(parseRecordReferenceHref("/inventory/products/cmprod")).toEqual({ kind: "product", id: "cmprod" });
    expect(parseRecordReferenceHref("/inventory/cmlot")).toEqual({ kind: "lot", id: "cmlot" });
    for (const page of ["/inventory/list", "/inventory/products", "/inventory/new", "/samples/new/x", "/experiments/abc", "https://x.org/samples/a"]) expect(parseRecordReferenceHref(page)).toBeNull();
  });

  it("writes one Markdown link that reads back as the same reference", () => {
    const markdown = recordReferenceMarkdown({ kind: "sample", id: "smp_1", label: "RNA-0001  KYSE150 [NC]\nRNA" });
    expect(markdown).toBe("[RNA-0001 KYSE150 ［NC］ RNA](/samples/smp_1)");
    expect(parseRecordReferenceLink(markdown)).toEqual({ kind: "sample", id: "smp_1", label: "RNA-0001 KYSE150 ［NC］ RNA" });
  });

  it("finds references in text and reads them as their labels", () => {
    const text = "取 [RNA-0001 KYSE150 NC RNA](/samples/smp_1)、[TRIzol · 批号 2311A](/inventory/lot_1) 和 [清单](/inventory/list)";
    expect(recordReferencesInText(text).map((reference) => `${reference.kind}:${reference.id}`)).toEqual(["sample:smp_1", "lot:lot_1"]);
    expect(stripRecordReferenceLinks(text)).toBe("取 RNA-0001 KYSE150 NC RNA、TRIzol · 批号 2311A 和 [清单](/inventory/list)");
  });

  it("labels samples by code and name, lots by lot number or place", () => {
    expect(sampleReferenceLabel({ code: "RNA-0001", name: "KYSE150 NC RNA" })).toBe("RNA-0001 KYSE150 NC RNA");
    expect(sampleReferenceLabel({ code: "CEL-0001", name: "CEL-0001" })).toBe("CEL-0001");
    expect(lotReferenceLabel({ productName: "TRIzol", lotNumber: "2311A" }, "批号")).toBe("TRIzol · 批号 2311A");
    expect(lotReferenceLabel({ productName: "TRIzol", lotNumber: " ", place: "Freezer A" }, "批号")).toBe("TRIzol · Freezer A");
    expect(lotReferenceLabel({ productName: "TRIzol" }, "批号")).toBe("TRIzol");
  });
});

import { describe, expect, it } from "vitest";
import { wellsBySample } from "./experiment-samples";
import { translateUiText } from "./i18n";
import { newPlateLayout, plateLayoutToMarkdown, setPlateValue } from "./plate-layout";
import { preparationChecklist } from "./run-preparation";
import { documentPlateLayouts, documentSampleIds, type ScientificDocument } from "./scientific-document";
import type { StructuredRunView } from "./structured-run";

const plate = setPlateValue(setPlateValue(newPlateLayout({ id: "plate-1", name: "qPCR", plateSize: 96, fieldNames: ["样本", "处理"] }),
  ["A1", "A2"], "sample", { sampleId: "smp_2", label: "RNA-0002" }), ["B1"], "sample", "RNA-0003");
const document: ScientificDocument = { schemaVersion: 1, sections: [
  { key: "setup", title: "Setup", blocks: [
    { id: "t1", type: "text", text: `取 [RNA-0001](/samples/smp_1) 与 [TRIzol](/inventory/lot_1)\n${plateLayoutToMarkdown(plate)}` },
    { id: "t2", type: "table", rows: [["样本"], ["[RNA-0004](/samples/smp_4)"]] },
  ] },
  { key: "observations", title: "Observations", blocks: [{ id: "t3", type: "text", text: "再取 [RNA-0001](/samples/smp_1)" }] },
] };

describe("what an experiment record names", () => {
  it("finds its plates and every sample it tags or plates, once each", () => {
    expect(documentPlateLayouts(document)).toEqual([plate]);
    expect(documentSampleIds(document)).toEqual(["smp_1", "smp_4", "smp_2"]);
  });

  it("places samples in wells by ID, and by code or a unique name when a well only holds text", () => {
    const samples = [{ id: "smp_2", code: "RNA-0002", name: "HeLa" }, { id: "smp_3", code: "RNA-0003", name: "HeLa" }, { id: "smp_9", code: "RNA-0009", name: "Other" }];
    expect(Object.fromEntries(wellsBySample([plate], samples))).toEqual({ smp_2: ["A1", "A2"], smp_3: ["B1"] });
  });

  it("lists a record's plate for the bench as a plate in the record", () => {
    const view = { hasSystems: true, versions: [], steps: {}, plan: { preparation: {}, groups: [] } } as unknown as StructuredRunView;
    const items = preparationChecklist(view, { plates: [{ id: "layout-plate-1", name: "qPCR", detail: "Plate layout in the record" }] }).items;
    expect(items).toContainEqual(expect.objectContaining({ key: "plate:layout-plate-1", kind: "plate", label: "qPCR", detail: "Plate layout in the record" }));
  });
});

describe("references and plates in Chinese", () => {
  it.each([
    ["Link a record", "引用"], ["Inventory item", "库存物品"], ["Plate layout", "板布局"], ["Mentioned in records", "记录中提到"],
    ["Used here", "本实验使用"], ["Discard changes", "放弃修改"], ["This experiment's samples used", "本实验的使用样本"],
  ])("%s", (english, chinese) => expect(translateUiText(english, "zh")).toBe(chinese));

  it("leaves the existing words for protocol references and stock use alone", () => {
    expect(translateUiText("References", "zh")).toBe("参考资料");
    expect(translateUiText("Used", "zh")).toBe("用量");
    expect(translateUiText("Discard", "zh")).toBe("弃置");
  });
});

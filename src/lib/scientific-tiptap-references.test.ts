import { describe, expect, it } from "vitest";
import { plainTextFromEntryMarkdown } from "./entry-content";
import { newPlateLayout, plateLayoutToMarkdown, setPlateValue } from "./plate-layout";
import { documentPlainText, normalizeScientificDocument, type ScientificDocument } from "./scientific-document";
import { markdownRichTextToTiptap, scientificDocumentToTiptap, tiptapToMarkdownRichText, tiptapToScientificDocument } from "./scientific-tiptap";

const plate = setPlateValue(newPlateLayout({ id: "plate-1", name: "qPCR 板 1", plateSize: 96, fieldNames: ["样本", "处理"] }), ["A1", "A2"], "sample", { sampleId: "smp_1", label: "RNA-0001 NC" });
const sample = "[RNA-0001 KYSE150 NC RNA](/samples/smp_1)", lot = "[TRIzol · 批号 2311A](/inventory/lot_1)";

describe("references and plates in LabNest Markdown", () => {
  it("opens references as tags and plates as blocks, and saves them back unchanged", () => {
    const markdown = `取 ${sample}、**两管** ${lot} 提取\n${plateLayoutToMarkdown(plate)}\n- 引物 [GAPDH](/inventory/products/prod_1)`;
    const json = markdownRichTextToTiptap(markdown);
    expect(json.content?.[0].content?.filter((node) => node.type === "recordReference").map((node) => node.attrs)).toEqual([
      { kind: "sample", id: "smp_1", label: "RNA-0001 KYSE150 NC RNA" }, { kind: "lot", id: "lot_1", label: "TRIzol · 批号 2311A" },
    ]);
    expect(json.content?.[1]).toEqual({ type: "documentPlate", attrs: { block: plate } });
    expect(tiptapToMarkdownRichText(json)).toBe(markdown);
  });

  it("keeps a tag in a heading and in a table cell of a scientific document", () => {
    const original: ScientificDocument = { schemaVersion: 1, sections: [{ key: "setup", title: "Setup", blocks: [] }] };
    const json = scientificDocumentToTiptap(original);
    json.content![0].content = [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "样本 " }, { type: "recordReference", attrs: { kind: "sample", id: "smp_1", label: "RNA-0001" } }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "样本" }] }] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "recordReference", attrs: { kind: "sample", id: "smp_1", label: "RNA-0001" } }] }] }] }] },
      { type: "documentPlate", attrs: { block: plate } },
    ];
    const saved = tiptapToScientificDocument(json, original);
    const [heading, table, plateBlock] = saved.sections[0].blocks;
    expect(heading).toMatchObject({ type: "text", text: "## 样本 [RNA-0001](/samples/smp_1)" });
    expect(table).toMatchObject({ type: "table", rows: [["样本"], ["[RNA-0001](/samples/smp_1)"]] });
    expect(plateBlock).toMatchObject({ type: "text", text: plateLayoutToMarkdown(plate) });
    // Saved text opens again as the same blocks.
    const reopened = normalizeScientificDocument(saved, [{ key: "setup", title: "Setup" }]);
    expect(tiptapToScientificDocument(scientificDocumentToTiptap(reopened), reopened).sections[0].blocks.map((block) => block.type)).toEqual(["text", "table", "text"]);
    // A formatted heading is kept as Markdown, so its search text keeps the "##", as before.
    expect(documentPlainText(saved)).toBe("## 样本 RNA-0001\n样本\nRNA-0001\n板布局：qPCR 板 1（96 孔） RNA-0001 NC");
  });

  it("searches Entry text by labels and plate values, never by the stored link or line", () => {
    const text = plainTextFromEntryMarkdown(`取 ${sample}\n${plateLayoutToMarkdown(plate)}`);
    expect(text).toBe("取 RNA-0001 KYSE150 NC RNA\n板布局：qPCR 板 1（96 孔） RNA-0001 NC");
  });
});

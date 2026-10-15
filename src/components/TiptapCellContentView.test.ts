import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
import { ChipRenderContext } from "@/components/protocol/ChipText";
import type { ProtocolContentBlock } from "@/lib/protocol-document";

describe("rich table cell rendering", () => {
  it("does not expand a partial risk color or font size to the whole cell", () => {
    const block: Extract<ProtocolContentBlock, { type: "table" }> = {
      id: "mixed-cell-table",
      type: "table",
      rows: [["Critical reference"]],
      cellColors: [["risk"]],
      cellFontSizesPt: [[12]],
      cellRichContent: [[[{ type: "paragraph", content: [
        { type: "text", text: "Critical", marks: [{ type: "textStyle", attrs: { color: "#8f4e52", fontSize: "12pt" } }] },
        { type: "text", text: " reference" },
      ] }]]],
    };

    const html = renderToStaticMarkup(createElement(ProtocolContentBlockView, { block }));
    const tableCell = html.match(/<th[^>]*>/)?.[0] ?? "";
    expect(tableCell).not.toContain("text-error");
    expect(tableCell).not.toContain("font-size");
    expect(html).toContain('class="text-error" style="font-size:12pt"');
    expect(html).toContain(" reference");
  });
});

describe("protocol tables in reading and execution views", () => {
  const systems = {
    schemaVersion: 1 as const, presets: [], restrictions: [],
    dimensions: [{ id: "volume", label: "裂解液体系", options: [{ id: "v350", label: "350 µL", symbol: "triangle" as const }, { id: "v600", label: "600 µL", symbol: "square" as const }] }],
    parameters: [{ id: "p-pk", label: "", unit: "µL", source: { kind: "fixed" as const, value: 50, unit: "µL" } }],
    rules: [{ id: "fat-row", target: "row" as const, targetId: "row-extra", when: { all: [{ dimensionId: "volume", optionId: "v600" }] }, parameterIds: [], optional: false, actualFields: [] }],
  };
  const block: Extract<ProtocolContentBlock, { type: "table" }> = {
    id: "recipe", type: "table",
    rows: [["试剂", "小体系", "大体系"], ["Proteinase K", "20", "30"], ["额外缓冲液 {{p-pk}}", "—", "100"]],
    rowIds: ["row-head", "row-pk", "row-extra"],
    columnConditions: [null, { dimensionId: "volume", optionId: "v350" }, { dimensionId: "volume", optionId: "v600" }],
    cellRichContent: [[null, null, null], [[{ type: "paragraph", content: [{ type: "text", text: "加入 {{p-pk}}" }] }], null, null], [null, null, null]],
  };

  it("reads parameter chips in table cells and marks system columns and rows, never showing a raw reference", () => {
    const html = renderToStaticMarkup(createElement(ChipRenderContext.Provider, { value: { systems } }, createElement(ProtocolContentBlockView, { block })));
    expect(html).not.toContain("{{");
    expect(html).not.toContain("p-pk");
    expect(html.match(/>50</g)?.length).toBe(2);
    const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect(head).toContain("仅");
    expect(head).toContain("350 µL");
    expect(head).toContain("600 µL");
    const extraRow = html.slice(html.lastIndexOf("<tr"));
    expect(extraRow).toContain("仅");
    expect(extraRow).toContain("600 µL");
  });
});

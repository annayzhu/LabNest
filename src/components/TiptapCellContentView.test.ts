import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificBlockView } from "./ScientificBlockView";
import { TiptapCellContentView } from "./TiptapCellContentView";
import { documentMediaToMarkdown } from "@/lib/document-media";

describe("read-only document media", () => {
  it("displays imported images inside table cells rather than encoded metadata", () => {
    const fallback = documentMediaToMarkdown({ id: "cell-image", type: "media", mediaType: "image", attachmentId: "cell-file", url: "", filename: "Cell image.png" });
    const html = renderToStaticMarkup(createElement(TiptapCellContentView, { fallback }));
    expect(html).toContain("<img");
    expect(html).toContain("/api/attachments/cell-file");
    expect(html).not.toContain("labnest-media:");
  });
  it("renders an actual image from attachment identity without a stored URL", () => {
    const html = renderToStaticMarkup(createElement(ScientificBlockView, { block: {
      id: "image", type: "media", mediaType: "image", url: "", attachmentId: "file-1", caption: "Microscopy", widthPercent: 60,
    } }));
    expect(html).toContain("<img");
    expect(html).toContain("/api/attachments/file-1?inline=1");
    expect(html).toContain("width:60%");
    expect(html).toContain("Microscopy");
  });
  it("renders a named audio attachment link without autoplay", () => {
    const html = renderToStaticMarkup(createElement(ScientificBlockView, { block: {
      id: "audio", type: "media", mediaType: "audio", url: "", attachmentId: "file-2", filename: "Observation.m4a",
    } }));
    expect(html).toContain('href="/attachments/file-2"');
    expect(html).toContain("Observation.m4a");
    expect(html).not.toContain("<audio");
  });
});

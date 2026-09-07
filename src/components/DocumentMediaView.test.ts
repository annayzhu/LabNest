import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificBlockView } from "./ScientificBlockView";

describe("read-only document media", () => {
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

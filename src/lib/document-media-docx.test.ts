import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { exportProtocolDocx } from "./protocol-docx-export";
import { createEmptyProtocolDocument } from "./protocol-document";
import { parseProtocolDocxBytes } from "./protocol-docx";

describe("Word media export", () => {
  it("embeds original image bytes in place, with its caption and display ratio", () => {
    const document = createEmptyProtocolDocument();
    document.sections[0].blocks = [
      { id: "before", type: "text", text: "Before image" },
      { id: "image", type: "media", mediaType: "image", url: "", attachmentId: "image-attachment", filename: "microscopy.png", caption: "Image caption", widthPercent: 60 },
      { id: "after", type: "text", text: "After image" },
    ];
    const bytes = new Uint8Array(readFileSync("public/icons/lab-soft-v1/solution-prep.png"));
    const archive = unzipSync(exportProtocolDocx({ canonicalTitle: "Media test", availability: "draft", reviewStage: "draft", displayVersion: "0.1", scope: "general", tags: [] }, document, { "image-attachment": { bytes, extension: "png", mimeType: "image/png", width: 512, height: 512 } }));
    const media = Object.keys(archive).filter(name => name.startsWith("word/media/"));
    expect(media).toHaveLength(1);
    expect(archive[media[0]]).toEqual(bytes);
    const xml = strFromU8(archive["word/document.xml"]);
    expect(xml.indexOf("Before image")).toBeLessThan(xml.indexOf("<w:drawing>"));
    expect(xml.indexOf("<w:drawing>")).toBeLessThan(xml.indexOf("After image"));
    expect(xml).toContain("Image caption");
    const imported = parseProtocolDocxBytes(exportProtocolDocx({ canonicalTitle: "Media test", availability: "draft", reviewStage: "draft", displayVersion: "0.1", scope: "general", tags: [] }, document, { "image-attachment": { bytes, extension: "png", mimeType: "image/png", width: 512, height: 512 } }), "PRT-123456_Media_v0.1_Draft.docx");
    expect(imported.document.sections[0].blocks.map(block => block.type)).toEqual(["text", "media", "text"]);
    expect(imported.embeddedImages?.[0].bytes).toEqual(bytes);
  });
});

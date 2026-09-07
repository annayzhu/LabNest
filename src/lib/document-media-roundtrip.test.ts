import { describe, expect, it } from "vitest";
import { scientificDocumentSchema } from "./scientific-document";
import { scientificDocumentToTiptap, tiptapToScientificDocument, markdownRichTextToTiptap, tiptapToMarkdownRichText } from "./scientific-tiptap";

describe("media document round trip", () => {
  it("keeps named audio and image nodes through Markdown editing without temporary URLs", () => {
    const block = { id: "audio-1", type: "media", mediaType: "audio", url: "", attachmentId: "attachment-2", filename: "实验录音.m4a", caption: "观察记录" };
    const node = { type: "documentMedia", attrs: { block } };
    const markdown = tiptapToMarkdownRichText({ type: "doc", content: [node] });
    expect(markdownRichTextToTiptap(markdown).content).toEqual([node]);
    expect(markdown).not.toMatch(/blob:|data:|base64/);
  });
  it("keeps a managed image identity, caption and display width after editing and validation", () => {
    const block = { id: "image-1", type: "media", mediaType: "image", url: "", attachmentId: "attachment-1", filename: "显微镜.png", mimeType: "image/png", size: 1200, caption: "Control, 20×", widthPercent: 60 };
    const doc = scientificDocumentSchema.parse({ schemaVersion: 1, sections: [{ key: "observations", title: "Observations", blocks: [block] }] });
    const saved = tiptapToScientificDocument(scientificDocumentToTiptap(doc), doc);
    expect(saved.sections[0].blocks).toEqual([block]);
  });
});

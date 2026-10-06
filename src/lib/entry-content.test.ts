import { describe, expect, it } from "vitest";
import { buildEntryContent, getEntryMarkdown, getOrderedAttachmentIds, parseEntryContent, plainTextFromEntryMarkdown } from "./entry-content";

describe("entry content documents", () => {
  it("builds ordered text and attachment blocks", () => {
    const document = buildEntryContent("**Observed** cells", [
      { id: "image-1", originalFilename: "cells.png", mimeType: "image/png", size: 100 },
      { id: "file-1", originalFilename: "notes.csv", mimeType: "text/csv", size: 200 },
    ]);

    expect(getEntryMarkdown(document)).toBe("**Observed** cells");
    expect(getOrderedAttachmentIds(document)).toEqual(["image-1", "file-1"]);
    expect(parseEntryContent(document)?.blocks.map((block) => block.type)).toEqual(["text", "image", "file"]);
  });

  it("derives searchable plain text without formatting markers", () => {
    expect(plainTextFromEntryMarkdown('## Result\n\n<!--labnest-line-height:1.5-->- **GFP** signal was <span data-labnest-size="12">++higher++</span>.\n- [ ] Review signal.\n- [Source](https://example.com)'))
      .toBe("Result\n\nGFP signal was higher.\nReview signal.\nSource");
  });

  it("falls back safely for malformed documents", () => {
    expect(parseEntryContent({ schemaVersion: 99, blocks: [] })).toBeUndefined();
    expect(getEntryMarkdown({}, "Legacy body")).toBe("Legacy body");
  });
});

it("counts current originals once and keeps removed inline media as history, regardless of filename", async () => {
  const { selectEntryAttachments } = await import("./entry-content");
  const { documentMediaToMarkdown } = await import("./document-media");
  const photos = ["a", "b", "c", "d"].map(id => ({ id, originalFilename: id === "d" ? "download" : `${id}.png`, mimeType: "image/png", size: 100, derivedFromId: null }));
  const markdown = photos.map(a => documentMediaToMarkdown({ id: `node-${a.id}`, type: "media", mediaType: "image", url: "", attachmentId: a.id })).join("\n");
  const old = { id: "old", originalFilename: "download", mimeType: "image/png", size: 100, derivedFromId: null };
  const links = [...photos.map(attachment => ({ attachment, linkType: "embedded_document_media" })), { attachment: photos[0], linkType: "entry_content" }, { attachment: old, linkType: "entry_content" }, { attachment: old, linkType: "document_media_history" }];
  expect(selectEntryAttachments(buildEntryContent(markdown, [old]), links).map(a => a.id)).toEqual(["a", "b", "c", "d"]);
});

it("counts four originals plus a PDF, not a repeated image position, URL or preview", async () => {
  const { selectEntryAttachments } = await import("./entry-content");
  const { documentMediaToMarkdown } = await import("./document-media");
  const markdown = ["a", "b", "c", "d", "a"].map((id,index) => documentMediaToMarkdown({ id: `node-${index}`, type: "media", mediaType: "image", url: "", attachmentId: id })).join("\n") + "\n[Link](https://example.com)";
  const pdf = { derivedFromId: null, id: "pdf", originalFilename: "test.pdf", mimeType: "application/pdf", size: 200 };
  const links = [...["a", "b", "c", "d"].map(id => ({ linkType: "embedded_document_media", attachment: { id, derivedFromId: null } })), { linkType: "entry_content", attachment: pdf }, { linkType: "attached_to", attachment: { id: "preview", derivedFromId: "a" } }];
  expect(selectEntryAttachments<{id:string;derivedFromId?:string|null}>(buildEntryContent(markdown, [pdf]), links).map(x => x.id)).toEqual(["a", "b", "c", "d", "pdf"]);
});

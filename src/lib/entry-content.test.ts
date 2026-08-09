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
    expect(plainTextFromEntryMarkdown("## Result\n\n- **GFP** signal was ++higher++.\n- [ ] Review signal.\n- [Source](https://example.com)"))
      .toBe("Result\n\nGFP signal was higher.\nReview signal.\nSource");
  });

  it("falls back safely for malformed documents", () => {
    expect(parseEntryContent({ schemaVersion: 99, blocks: [] })).toBeUndefined();
    expect(getEntryMarkdown({}, "Legacy body")).toBe("Legacy body");
  });
});

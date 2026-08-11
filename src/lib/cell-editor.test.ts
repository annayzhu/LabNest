import { describe, expect, it } from "vitest";
import { isCellRenderShortcut, protocolRichTextHasContent, scientificBlockHasContent } from "./cell-editor";

describe("notebook-style cell editing", () => {
  it("recognizes Command/Ctrl + Enter only", () => {
    expect(isCellRenderShortcut({ key: "Enter", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isCellRenderShortcut({ key: "Enter", metaKey: false, ctrlKey: true })).toBe(true);
    expect(isCellRenderShortcut({ key: "Enter", metaKey: false, ctrlKey: false })).toBe(false);
    expect(isCellRenderShortcut({ key: "a", metaKey: true, ctrlKey: false })).toBe(false);
  });

  it("starts empty scientific and rich-text blocks in edit mode", () => {
    expect(scientificBlockHasContent({ id: "text-1", type: "text", text: "" })).toBe(false);
    expect(scientificBlockHasContent({ id: "table-1", type: "table", rows: [["Header"], [""]] })).toBe(true);
    expect(protocolRichTextHasContent([{ type: "paragraph", content: [{ text: "" }] }])).toBe(false);
    expect(protocolRichTextHasContent([{ type: "paragraph", content: [{ text: "Observed cells" }] }])).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { editorStyleNameExists, parseEditorNamedStyles, upsertEditorNamedStyle } from "./editor-named-styles";

describe("editor named styles", () => {
  it("rejects malformed browser data and keeps valid user styles", () => {
    expect(parseEditorNamedStyles("not json")).toEqual([]);
    expect(parseEditorNamedStyles(JSON.stringify([{ id: "lab-note", name: "Lab note", paragraphType: "paragraph", bold: true }]))).toEqual([
      expect.objectContaining({ id: "lab-note", name: "Lab note", paragraphType: "paragraph", bold: true, schemaVersion: 1 }),
    ]);
  });

  it("updates a named style without duplicating it", () => {
    const original = parseEditorNamedStyles(JSON.stringify([{ id: "lab-note", name: "Lab note", paragraphType: "paragraph" }]));
    expect(upsertEditorNamedStyle(original, { ...original[0], name: "Lab note revised", paragraphType: "heading3", fontSize: "12pt" })[0]).toMatchObject({ id: "lab-note", name: "Lab note revised", paragraphType: "heading3", fontSize: "12pt" });
  });

  it("detects duplicate names case-insensitively", () => {
    const styles = parseEditorNamedStyles(JSON.stringify([{ id: "lab-note", name: "Lab note", paragraphType: "paragraph" }]));
    expect(editorStyleNameExists(styles, " lab NOTE ")).toBe(true);
  });
});

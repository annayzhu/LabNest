import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("shared document surface contract", () => {
  it("keeps print controls out of reusable preview canvases", () => {
    expect(source("src/components/ScientificDocumentView.tsx")).not.toContain("toolbar={<DocumentPrintButton />}");
    expect(source("src/components/ProtocolDocumentView.tsx")).not.toContain("toolbar={<DocumentPrintButton />}");
    expect(source("src/app/entries/[id]/page.tsx")).not.toContain("toolbar={<DocumentPrintButton />}");
  });

  it("does not use the editor drawer class for read-only preview sidebars", () => {
    for (const path of [
      "src/app/protocols/[id]/page.tsx",
      "src/app/experiments/[id]/page.tsx",
      "src/app/results/[id]/page.tsx",
    ]) {
      expect(source(path)).not.toContain('className="document-editor-sidebar');
    }
  });

  it("offers attachment inserts in the Entry document toolbar", () => {
    expect(source("src/components/EntryComposer.tsx")).toContain("insertActions={entryInsertActions}");
  });

  it("does not derive Entry source classification from attachment MIME types", () => {
    expect(source("src/components/EntryComposer.tsx")).not.toContain('updateField("sourceType", files.some');
  });
});

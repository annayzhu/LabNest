import { describe, expect, it } from "vitest";
import { persistedTableFromTiptap, tiptapTableRows, type PersistedTiptapTable } from "@/lib/tiptap-table-serialization";

describe("Tiptap table serialization", () => {
  it("round-trips mixed inline formatting inside one cell", () => {
    const cell = [{
      type: "paragraph",
      content: [
        { type: "text", text: "Critical", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#8f4e52", fontSize: "12pt" } }] },
        { type: "text", text: " reference", marks: [{ type: "italic" }, { type: "link", attrs: { href: "https://example.test/evidence" } }, { type: "textStyle", attrs: { fontSize: "9pt" } }] },
      ],
    }];
    const table: PersistedTiptapTable = {
      rows: [["Finding"], ["Critical reference"]],
      cellRichContent: [[null], [cell]],
    };

    const roundTrip = persistedTableFromTiptap({ type: "table", content: tiptapTableRows(table) });
    expect(roundTrip.rows).toEqual(table.rows);
    expect(roundTrip.cellRichContent).toEqual(table.cellRichContent);
  });
});

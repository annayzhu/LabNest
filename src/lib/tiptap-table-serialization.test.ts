import { describe, expect, it } from "vitest";
import { persistedTableFromTiptap, tiptapTableRows, type PersistedTiptapTable } from "@/lib/tiptap-table-serialization";

describe("Tiptap table serialization", () => {
  it("round-trips mixed inline formatting inside one cell", () => {
    const cell = [{
      type: "paragraph",
      content: [
        { type: "text", text: "Critical", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#8f4e52", fontSize: "12pt" } }] },
        { type: "text", text: " reference" },
      ],
    }];
    const table: PersistedTiptapTable = {
      rows: [["Finding"], ["Critical reference"]],
      cellRichContent: [[null], [cell]],
    };

    const roundTrip = persistedTableFromTiptap({ type: "table", content: tiptapTableRows(table) });
    expect(roundTrip.rows).toEqual(table.rows);
    expect(roundTrip.cellRichContent).toEqual(table.cellRichContent);
    expect(roundTrip.cellFontSizesPt).toBeUndefined();
    expect(roundTrip.cellColors).toBeUndefined();
  });
});

it('retains paragraph-only cell layout and paragraph breaks through persistence', () => {
  const source={type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'paragraph',attrs:{textAlign:'right',documentIndent:2,spaceAfterPt:6,documentLineHeight:'1.5'},content:[{type:'text',text:'10 µL'}]},{type:'paragraph',content:[{type:'text',text:'中文说明'}]}]}]}]};
  const persisted=persistedTableFromTiptap(source);
  expect(persisted.cellRichContent?.[0]?.[0]).toEqual(source.content[0].content[0].content);
  expect(persisted.rows[0][0]).toBe('10 µL\n中文说明');
  expect(tiptapTableRows(persisted)[0].content?.[0].content).toEqual(source.content[0].content[0].content);
});

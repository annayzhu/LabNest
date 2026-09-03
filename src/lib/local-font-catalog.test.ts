import { describe, expect, it } from "vitest";
import { groupLocalFontFaces, parseLocalFontFamilies } from "./local-font-catalog";

describe("local font catalog", () => {
  it("groups browser-discovered faces into one family", () => {
    expect(groupLocalFontFaces([
      { family: "Example Sans", fullName: "Example Sans Regular", postscriptName: "ExampleSans-Regular", style: "Regular" },
      { family: "Example Sans", fullName: "Example Sans Bold", postscriptName: "ExampleSans-Bold", style: "Bold" },
      { family: "Example Serif", fullName: "Example Serif Italic", postscriptName: "ExampleSerif-Italic", style: "Italic" },
    ])).toEqual([
      expect.objectContaining({ name: "Example Sans", styles: ["Bold", "Regular"] }),
      expect.objectContaining({ name: "Example Serif", styles: ["Italic"] }),
    ]);
  });

  it("rejects malformed persisted records without losing valid families", () => {
    expect(parseLocalFontFamilies(JSON.stringify([
      { id: "f123", name: "Example Sans", styles: ["Regular"], fullNames: [], postscriptNames: [] },
      { id: "../bad", name: "Unsafe" },
    ]))).toEqual([expect.objectContaining({ id: "f123", name: "Example Sans" })]);
  });
});

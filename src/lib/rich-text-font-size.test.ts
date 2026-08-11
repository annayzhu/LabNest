import { describe, expect, it } from "vitest";
import {
  isRichTextFontSizePt,
  parseLabNestFontSizeToken,
  parseRichTextFontSizePt,
  stripLabNestFontSizeMarkup,
} from "./rich-text-font-size";

describe("controlled rich-text font sizes", () => {
  it("accepts only the A4-safe presets", () => {
    expect(isRichTextFontSizePt(8)).toBe(true);
    expect(parseRichTextFontSizePt("14")).toBe(14);
    expect(parseRichTextFontSizePt("13")).toBeUndefined();
    expect(parseRichTextFontSizePt("14px")).toBeUndefined();
  });

  it("parses and strips the persisted inline marker", () => {
    expect(parseLabNestFontSizeToken('<span data-labnest-size="12">**Result**</span>')).toEqual({
      size: 12,
      content: "**Result**",
    });
    expect(stripLabNestFontSizeMarkup('A <span data-labnest-size="12">large</span> result')).toBe("A large result");
  });
});

import { describe, expect, it } from "vitest";
import {
  parseRichTextLineHeight,
  parseRichTextLineHeightLine,
  richTextLineHeightPrefix,
  stripLabNestLineHeightMarkup,
} from "./rich-text-line-height";

describe("controlled rich-text line heights", () => {
  it("accepts only the compact A4 presets", () => {
    expect(parseRichTextLineHeight("1")).toBe(1);
    expect(parseRichTextLineHeight("1.15")).toBe(1.15);
    expect(parseRichTextLineHeight("1.3")).toBe(1.3);
    expect(parseRichTextLineHeight("1.6")).toBe(1.6);
    expect(parseRichTextLineHeight("1.25")).toBeUndefined();
  });

  it("round-trips non-default line metadata without polluting plain text", () => {
    const value = `${richTextLineHeightPrefix(1.3)}**Observation**`;
    expect(parseRichTextLineHeightLine(value)).toEqual({ lineHeight: 1.3, content: "**Observation**" });
    expect(richTextLineHeightPrefix(1.6)).toBe("");
    expect(richTextLineHeightPrefix(1.5)).toBe("<!--labnest-line-height:1.5-->");
    expect(richTextLineHeightPrefix(1)).toBe("<!--labnest-line-height:1-->");
    expect(stripLabNestLineHeightMarkup(value)).toBe("**Observation**");
  });
});

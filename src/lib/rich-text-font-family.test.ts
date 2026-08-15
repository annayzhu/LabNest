import { describe, expect, it } from "vitest";
import {
  parseRichTextFontFamily,
  parseRichTextFontFamilyLine,
  richTextFontFamilyPrefix,
  stripLabNestFontFamilyMarkup,
} from "./rich-text-font-family";

describe("rich text font families", () => {
  it("round-trips controlled block font-family metadata", () => {
    expect(richTextFontFamilyPrefix("serif")).toBe("<!--labnest-font-family:serif-->");
    expect(parseRichTextFontFamilyLine("<!--labnest-font-family:serif-->Result")).toEqual({ fontFamily: "serif", content: "Result" });
    expect(parseRichTextFontFamily("Comic Sans MS")).toBeUndefined();
  });

  it("strips formatting metadata from plain-text projections", () => {
    expect(stripLabNestFontFamilyMarkup("<!--labnest-font-family:mono-->A260/A280")).toBe("A260/A280");
  });
});

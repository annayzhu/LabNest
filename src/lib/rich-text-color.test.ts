import { describe, expect, it } from "vitest";
import { parseLabNestColorToken, parseRichTextColor, stripLabNestColorMarkup } from "./rich-text-color";

describe("rich text semantic colors", () => {
  it("recognizes the controlled risk color and its persisted token", () => {
    expect(parseRichTextColor("#9C4848")).toBe("risk");
    expect(parseLabNestColorToken('<mark data-labnest-color="risk">Critical step</mark>')).toEqual({ color: "risk", content: "Critical step" });
    expect(stripLabNestColorMarkup('Keep <mark data-labnest-color="risk">cold</mark>.')).toBe("Keep cold.");
  });
});

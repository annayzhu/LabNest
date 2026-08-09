import { describe, expect, it } from "vitest";
import { parseTags } from "./tags";

describe("parseTags", () => {
  it("accepts English and Chinese commas and semicolons", () => {
    expect(parseTags("RNA,qPCR；protein; imaging，QC")).toEqual(["RNA", "qPCR", "protein", "imaging", "QC"]);
  });

  it("accepts spaces, tabs, and line breaks", () => {
    expect(parseTags("RNA qPCR\tprotein\nimaging")).toEqual(["RNA", "qPCR", "protein", "imaging"]);
  });

  it("removes empty and duplicate tags while retaining order", () => {
    expect(parseTags("RNA, RNA；qPCR  qPCR")).toEqual(["RNA", "qPCR"]);
  });
});

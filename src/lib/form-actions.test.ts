import { describe, expect, it } from "vitest";
import { formActionErrorMessage } from "./form-actions";

describe("form action error messages", () => {
  it("uses expected error and validation messages", () => {
    expect(formActionErrorMessage(new Error("Already exists."), "Fallback")).toBe("Already exists.");
    expect(formActionErrorMessage({ issues: [{ message: "Field is required." }] }, "Fallback")).toBe("Field is required.");
  });

  it("uses safe fallbacks for empty and unique constraint errors", () => {
    expect(formActionErrorMessage(new Error(""), "Could not save.")).toBe("Could not save.");
    expect(formActionErrorMessage({ code: "P2002" }, "Could not save.", "Identifier is in use.")).toBe("Identifier is in use.");
  });
});

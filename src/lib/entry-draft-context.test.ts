import { expect, it } from "vitest";
import { entryDraftKey, entryDraftMatchesContext } from "./entry-draft-context";

it("keeps experiment and step drafts separate and rejects unrelated legacy recovery", () => {
  const a = { experimentId: "A", experimentStepId: "one" };
  const b = { experimentId: "B", experimentStepId: "one" };
  expect(entryDraftKey(undefined, a)).not.toBe(entryDraftKey(undefined, b));
  expect(entryDraftKey(undefined, a)).not.toBe(entryDraftKey(undefined, { ...a, experimentStepId: "two" }));
  expect(entryDraftMatchesContext(a, b)).toBe(false);
  const recovered = { ...a, title: "Recovered" };
  expect(entryDraftMatchesContext(a, recovered)).toBe(true);
  expect(entryDraftKey("existing", b)).toBe("entry-composer:existing");
});

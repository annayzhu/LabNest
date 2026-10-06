import { describe, expect, it } from "vitest";
import { entrySaveSignature } from "./entry-save-identity";
describe("entry save retry identity", () => {
 it("accepts replay of the same operation, rejects changed content or files", () => {
  const input = {title:"测试",contentMarkdown:"正文",eventTimePrecision:"unknown",occurredAt:new Date(0)};
  const first = entrySaveSignature(input,["file-a"],[]);
  expect(entrySaveSignature({...input,occurredAt:new Date(1000)},["file-a"],[])).toBe(first);
  expect(entrySaveSignature({...input,contentMarkdown:"changed"},["file-a"],[])).not.toBe(first);
  expect(entrySaveSignature(input,["file-b"],[])).not.toBe(first);
 });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProtocolDocumentView } from "@/components/ProtocolDocumentView";
import { I18nProvider } from "@/components/I18nProvider";
import { createEmptyProtocolDocument, protocolDocumentSchema } from "@/lib/protocol-document";

const systems = {
  schemaVersion: 1, presets: [], restrictions: [], parameters: [],
  dimensions: [{ id: "volume", label: "裂解液体系", options: [{ id: "v350", label: "350 µL", symbol: "triangle" }, { id: "v600", label: "600 µL", symbol: "square" }] }],
  rules: [{ id: "only-600", target: "step", targetId: "legacy-b", when: { all: [{ dimensionId: "volume", optionId: "v600" }] }, parameterIds: [], optional: false, actualFields: [] }],
};
const paragraph = (text: string) => ({ type: "paragraph", content: [{ text }] });
const render = (blocks: unknown[]) => renderToStaticMarkup(createElement(I18nProvider, null, createElement(ProtocolDocumentView, { document: protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), systems, sections: [{ key: "steps", title: "Steps", blocks }] }) })));

describe("Reading a Protocol across all systems", () => {
  it("shows which system an older, organized step is for, above the step and its details", () => {
    const html = render([
      { id: "a", type: "heading", text: "裂解", execution: { role: "step", stepId: "legacy-a", title: "裂解" } },
      { id: "a-detail", type: "text", text: "加入裂解液。", execution: { role: "detail", stepId: "legacy-a" } },
      { id: "b", type: "heading", text: "补加缓冲液", execution: { role: "step", stepId: "legacy-b", title: "补加缓冲液" } },
      { id: "b-detail", type: "text", text: "再加 100 µL。", execution: { role: "detail", stepId: "legacy-b" } },
    ]);
    const steps = html.split('class="ln-protocol-legacy-step"').slice(1);
    expect(steps).toHaveLength(2);
    expect(steps[0]).not.toContain("仅");
    expect(steps[1]).toMatch(/仅[\s\S]*600 µL[\s\S]*补加缓冲液[\s\S]*再加 100 µL/);
  });

  it("keeps numbering steps after a note between them", () => {
    const step = (id: string, text: string) => ({ id, type: "rich_text", nodes: [paragraph(text)], execution: { role: "step", stepId: id, format: "block" } });
    const html = render([step("s1", "加样"), step("s2", "混匀"), { id: "note", type: "rich_text", nodes: [paragraph("以下在冰上操作。")], execution: { role: "info" } }, step("s3", "离心")]);
    const lists = [...html.matchAll(/<ol[^>]*class="ln-protocol-document-steps"[^>]*>/g)].map(match => match[0]);
    expect(lists).toHaveLength(2);
    expect(lists[1]).toContain('start="3"');
    expect(lists[1]).toContain("counter-reset:ln-step 2");
  });
});

import { collectDocumentMedia, documentMediaAttachmentId } from "./document-media";
import { plainTextFromEntryMarkdown } from "./entry-content";
import { keptLines } from "./entry-tidy";
import { scientificDocumentSchema } from "./scientific-document";
import { markdownRichTextToTiptap, tiptapToMarkdownRichText } from "./scientific-tiptap";
import { entryToolDocument, toolOutputFromMarkdown, toolOutputToMarkdown, toolOutputs as toolOutputsInDocument } from "./tool-workflow";
import { describe, expect, it } from 'vitest';
import { freshToolDraft, mergeToolDocumentDraft, mergeToolOutput, type ToolOutputBlock } from './tool-workflow';
import { documentPlainText, documentPlateLayouts, documentSampleIds, type ScientificDocument } from './scientific-document';
const doc = (): ScientificDocument => ({ schemaVersion: 1, sections: [{ key: 'custom', title: 'Observations', blocks: [{id:'note',type:'text',text:'Human observation'}] }] });
const output: ToolOutputBlock = {id:'artifact-a',type:'tool_output',label:'qPCR 分析',toolId:'qpcr-analysis',revision:1,submissionId:'submit-a',sessionAttachmentId:'session-a',images:[],table:{headers:['Sample','Value'],rows:[['S1','2']]},method:'Technical replicates'};
describe('qPCR output in the current record', () => {
  it('adds analysis without replacing custom sections or human text; replay inserts once', () => {
    const first = mergeToolOutput(doc(), output, 'analysis', 0);
    expect(first.sections[0]).toEqual(doc().sections[0]);
    expect(first.sections[1].blocks).toEqual([output]);
    expect(mergeToolOutput(first, output, 'analysis', 0)).toEqual(first);
  });
});
it('updates one output, preserves neighboring text, and rejects stale revisions', () => {
  const first = mergeToolOutput(doc(),output,'analysis',0);
  first.sections[1].blocks.push({id:'conclusion',type:'text',text:'My conclusion'});
  const updated = {...output,revision:2,submissionId:'submit-b'};
  const next = mergeToolOutput(first,updated,'analysis',1);
  expect(next.sections[1].blocks).toEqual([updated,{id:'conclusion',type:'text',text:'My conclusion'}]);
  expect(() => mergeToolOutput(next,{...output,submissionId:'submit-c'},'analysis',1)).toThrow('此结果已有新版本');
});
it('merges independent paragraphs while detecting concurrent edits to the same paragraph', async () => {
  const { mergeToolDocumentDraft } = await import('./tool-workflow');
  const base = doc();
  const local = doc(); local.sections[0].blocks.push({id:'local',type:'text',text:'Unsaved observation'});
  const remote = mergeToolOutput(base,output,'analysis',0);
  expect(mergeToolDocumentDraft(base,local,remote).sections.flatMap(s=>s.blocks).map(b=>b.id)).toEqual(['note','local','artifact-a']);
  remote.sections[0].blocks[0] = {id:'note',type:'text',text:'Other window'};
  local.sections[0].blocks[0] = {id:'note',type:'text',text:'This window'};
  expect(() => mergeToolDocumentDraft(base,local,remote)).toThrow();
});
it('reopens an output in a custom template without losing custom sections', async () => {
  const { normalizeScientificDocument, resultSections } = await import('./scientific-document');
  const saved = mergeToolOutput(doc(),output,'analysis',0);
  const reopened = normalizeScientificDocument(saved,resultSections);
  expect(reopened.sections.find(section=>section.key==='custom')).toEqual(doc().sections[0]);
  expect(reopened.sections.find(section=>section.key==='analysis')?.blocks).toEqual([output]);
});

it('a planner output links its samples to the record and is read as a plate', () => {
  const plate = { id: 'p1', name: 'Plate 01', plateSize: 96 as const, fields: [{ id: 'sample', name: '样本' }, { id: 'gene', name: '基因' }], colorField: 'gene', wells: { A1: { sample: { sampleId: 's1', label: 'S1' }, gene: 'GAPDH' }, A2: { sample: 'typed in', gene: 'GAPDH' } } };
  const document: ScientificDocument = { schemaVersion: 1, sections: [{ key: 'setup', title: 'Setup', blocks: [{ ...output, toolId: 'qpcr-plate-layout', plates: [plate] }] }] } as ScientificDocument;
  expect(documentPlateLayouts(document)).toEqual([plate]);
  expect(documentSampleIds(document)).toEqual(['s1']);
  expect(documentPlainText(document)).toContain('Plate 01');
});

describe("a tool output kept in Markdown (Entry)", () => {
  const block: ToolOutputBlock = { id: "tool-1", type: "tool_output", label: "pX · v1.0", toolId: "plasmid-workbench", revision: 1, submissionId: "s-1", sessionAttachmentId: "session", images: [{ url: "/api/attachments/map?inline=1", caption: "地图 (map)" }], table: { headers: ["项目"], rows: [["长度"]] }, method: "m", plasmid: { productId: "p", versionId: "v", versionLabel: "v1.0" } };
  it("comes back whole from its line", () => {
    expect(toolOutputFromMarkdown(toolOutputToMarkdown(block))).toEqual(block);
    expect(toolOutputFromMarkdown("<!--labnest-tool:%7B%7D-->")).toBeUndefined();
    expect(toolOutputFromMarkdown("plain text")).toBeUndefined();
  });
  it("survives the editor, between the lines around it", () => {
    const markdown = `before\n${toolOutputToMarkdown(block)}\nafter`;
    const json = markdownRichTextToTiptap(markdown);
    expect(json.content?.[1]).toEqual({ type: "documentTool", attrs: { block } });
    expect(tiptapToMarkdownRichText(json)).toBe(markdown);
  });
  it("keeps its files with the Entry and reads as its label", () => {
    const line = toolOutputToMarkdown(block);
    expect(collectDocumentMedia(line).map(documentMediaAttachmentId)).toEqual(expect.arrayContaining(["session", "map"]));
    expect(plainTextFromEntryMarkdown(line)).toBe("pX · v1.0");
    expect(keptLines(`note\n${line}`)).toContain(line);
  });
  it("gives the save route a document to check revisions against", () => {
    const document = entryToolDocument(`note\n${toolOutputToMarkdown(block)}`);
    expect(scientificDocumentSchema.safeParse(document).success).toBe(true);
    expect(toolOutputsInDocument(document).map((item) => item.id)).toEqual(["tool-1"]);
  });
});

describe("a tool save keeps the document in order", () => {
  const text = (id: string, value: string) => ({ id, type: "text" as const, text: value });
  const document = (...blocks: ReturnType<typeof text>[]): ScientificDocument => ({ schemaVersion: 1, sections: [{ key: "s", title: "S", blocks }] });
  it("leaves a paragraph split at the cursor where it was", () => {
    const base = document(text("t", "one\ntwo"), text("table", "T"), text("t2", "end"));
    const local = document(text("t", "one"), text("f", "two"), text("table", "T"), text("t2", "end"));
    expect(mergeToolDocumentDraft(base, local, base).sections[0].blocks.map((block) => block.id)).toEqual(["t", "f", "table", "t2"]);
  });
  it("puts a new first paragraph first and still takes another window's new blocks", () => {
    const base = document(text("a", "a"));
    const remote = document(text("a", "a"), text("other", "from another window"));
    const local = document(text("new", "first"), text("a", "a"));
    expect(mergeToolDocumentDraft(base, local, remote).sections[0].blocks.map((block) => block.id)).toEqual(["new", "a", "other"]);
  });
});

describe("a draft in this browser", () => {
  const at = "2026-11-04T10:00:00.000Z";
  it("applies only to the saved version it was made from", () => {
    const saved = { form: { expectedUpdatedAt: at } };
    expect(freshToolDraft(saved, at, true)).toBe(saved);
    expect(freshToolDraft(saved, new Date(at), true)).toBe(saved);
    expect(freshToolDraft(saved, "2026-11-04T11:00:00.000Z", true)).toBeUndefined();
    expect(freshToolDraft({}, at, true)).toBeUndefined();
  });
  it("of a record not yet saved has nothing to go stale against", () => {
    const saved = { form: {} };
    expect(freshToolDraft(saved, undefined, false)).toBe(saved);
  });
});

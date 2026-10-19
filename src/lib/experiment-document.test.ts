import { describe, expect, it } from "vitest";
import {
  appendExperimentObservation,
  experimentExecutionDocument,
  experimentDocumentFromNarrative,
  experimentNarrativeFromDocument,
  experimentSearchText,
} from "./experiment-document";
import { createScientificDocument, experimentSections } from "./scientific-document";

describe("Experiment structured document", () => {
  it("indexes every supported block type without making the mirror authoritative", () => {
    const document = createScientificDocument(experimentSections);
    document.sections[0]!.blocks.push({ id: "text", type: "text", text: "Serum starvation rationale" });
    document.sections[1]!.blocks.push({ id: "table", type: "table", rows: [["Sample", "Dose"], ["A549", "10 nM"]] });
    document.sections[2]!.blocks.push({ id: "checklist", type: "checklist", items: ["Wash cells", "Add reagent"] });
    document.sections[3]!.blocks.push({ id: "media", type: "media", mediaType: "image", url: "/api/attachments/image", caption: "Confluence before treatment" });
    document.sections[4]!.blocks.push({ id: "warning", type: "callout", tone: "warning", text: "Incubator recovery was delayed" });
    document.sections[5]!.blocks.push({ id: "metric", type: "metric", label: "Viability", value: "92", unit: "%" });

    const text = experimentSearchText("Confirm treatment response", document);

    expect(text).toContain("Confirm treatment response");
    expect(text).toContain("Serum starvation rationale");
    expect(text).toContain("A549");
    expect(text).toContain("Wash cells");
    expect(text).toContain("Confluence before treatment");
    expect(text).toContain("Incubator recovery was delayed");
    expect(text).toContain("Viability: 92 %");
  });

  it("appends run notes while preserving migrated and previously authored blocks", () => {
    const original = createScientificDocument(experimentSections);
    const observations = (document: typeof original) => document.sections.find(section => section.key === "observations")!;
    observations(original).blocks.push({ id: "observations-legacy", type: "text", text: "Legacy observation" });

    const next = appendExperimentObservation(original, {
      id: "run-note-1",
      text: "  Cells remained attached after washing.  ",
      recordedAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(observations(next).blocks).toEqual([
      { id: "observations-legacy", type: "text", text: "Legacy observation" },
      { id: "run-note-1", type: "text", text: "[2026-08-10T01:02:03.000Z]\nCells remained attached after washing." },
    ]);
    expect(observations(original).blocks).toHaveLength(1);
  });

  it("round-trips portable narrative fields and keeps summary and conclusion distinct", () => {
    const document = experimentDocumentFromNarrative({
      background: "Biological rationale",
      materials: "A549 cells and vehicle control",
      steps: "Wash, treat, incubate",
      observations: "No visible detachment",
      deviations: "Incubation extended by five minutes",
      resultSummary: "Signal increased",
      conclusion: "Repeat with an independent batch",
    });

    expect(document.sections.find((section) => section.key === "conclusion")?.blocks).toHaveLength(2);
    expect(experimentNarrativeFromDocument(document)).toEqual({
      background: "Biological rationale",
      materials: "A549 cells and vehicle control",
      steps: "Wash, treat, incubate",
      observations: "No visible detachment",
      deviations: "Incubation extended by five minutes",
      conclusion: "Signal increased\nRepeat with an independent batch",
    });
  });
});

it("projects all Run steps in execution order without replacing authored notes", () => {
  const source = experimentDocumentFromNarrative({steps:"手写实验记录"});
  const steps = [
    {id:"3",groupOrder:0,order:3,groupTitle:"锁定规程 v1",title:"检测",completed:false,deviationNote:null},
    {id:"1",groupOrder:0,order:1,groupTitle:"锁定规程 v1",title:"取样",completed:true,deviationNote:null},
    {id:"2",groupOrder:0,order:2,groupTitle:"锁定规程 v1",title:"培养",completed:true,deviationNote:"实际延长 5 分钟"},
  ];
  const projected = experimentExecutionDocument(source, steps);
  const text = experimentNarrativeFromDocument(projected).steps;
  expect(text).toContain("手写实验记录");
  expect(text).toContain("1. ✓ 取样");
  expect(text).toContain("2. ✓ 培养 偏差（见偏差与事件）");
  expect(text).toContain("3. 未完成 检测");
  expect(experimentNarrativeFromDocument(projected).deviations).toBe("第 2 步 · 其他 · 实际延长 5 分钟");
  expect(text.indexOf("取样")).toBeLessThan(text.indexOf("培养"));
  expect(experimentNarrativeFromDocument(source).steps).toBe("手写实验记录");
  expect(experimentNarrativeFromDocument(experimentExecutionDocument(projected,steps)).steps).toBe(text);
});

it('retains stored execution parameters at experiment scope without assigning them to a step', () => {
  const doc=experimentExecutionDocument(undefined,[],{sample_count:2,reaction_volume:3});
  const execution=doc.sections.find(section=>section.key==='execution')!;
  expect(execution.blocks).toContainEqual({id:'run-derived:parameters',type:'table',caption:'本次执行参数（实验级记录，不推定属于某一步骤）',rows:[['原记录参数','值'],['sample_count','2'],['reaction_volume','3']]});
  expect(experimentExecutionDocument(doc,[],{sample_count:4}).sections.find(section=>section.key==='execution')!.blocks).toHaveLength(1);
});

it("labels derived deviations explicitly without styling authored warnings as execution", () => {
 const source=createScientificDocument(experimentSections);
 source.sections.find(s=>s.key==='execution')!.blocks=[{id:'authored',type:'callout',tone:'critical',text:'偏差是观察内容，不是执行状态'}];
 const result=experimentExecutionDocument(source,[{id:'step1',groupOrder:0,order:1,groupTitle:'Method v1',title:'Inspect',completed:false,deviationNote:'延长5分钟'}]);
 const blocks=result.sections.find(s=>s.key==='execution')!.blocks;
 expect(blocks[0]).not.toHaveProperty('execution');
 expect(blocks.find(b=>b.id==='run-derived:step1')).toMatchObject({execution:{role:'step',stepId:'step1',completed:false,deviationLabel:'偏差',deviationNote:'延长5分钟'}});
 expect(source.sections.find(s=>s.key==='execution')!.blocks).toHaveLength(1);
});

it('preserves documentation-only frozen references and nested prose in exports without inventing completed operations',()=>{
 const snapshot = {versions:[{protocolVersionId:'v',protocolTitle:'Reference only',contentJson:{
  schemaVersion:1,sections:[{key:'steps',title:'Steps',blocks:[{
   id:'info',type:'rich_text',nodes:[{type:'paragraph',content:[{text:'用量参考 200 µL'}],
    childContent:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'嵌套说明 5 min'}]}]}]}],
   }],
  }]}],
 }}]};
 const doc=experimentExecutionDocument(undefined,[],{},snapshot),text=experimentNarrativeFromDocument(doc).steps;
 expect(text).toContain('用量参考 200 µL');expect(text).toContain('嵌套说明 5 min');
 expect(doc.sections.flatMap(section=>section.blocks).filter(block=>'execution' in block&&block.execution?.role==='step')).toHaveLength(0);
});

it("reads as one part per Protocol with this run's values only, folds the other system's steps, and lists deviations in 偏差与事件", async () => {
  const { createEmptyProtocolDocument } = await import("./protocol-document");
  const protocol = createEmptyProtocolDocument();
  protocol.executionConfirmed = true;
  protocol.systems = { schemaVersion: 1, dimensions: [{ id: "volume", label: "裂解液", options: [{ id: "s", label: "350 µL" }, { id: "l", label: "600 µL" }] }], presets: [], restrictions: [],
    rules: [{ id: "only-large", target: "step", targetId: "extra", when: { all: [{ dimensionId: "volume", optionId: "l" }] }, parameterIds: [], optional: false, actualFields: [] }],
    parameters: [{ id: "dose", label: "", unit: "µL", origin: "chip", source: { kind: "lookup", values: [{ id: "a", when: { all: [{ dimensionId: "volume", optionId: "s" }] }, value: 350, unit: "µL" }, { id: "b", when: { all: [{ dimensionId: "volume", optionId: "l" }] }, value: 600, unit: "µL" }] } }] };
  protocol.sections.find(section => section.key === "steps")!.blocks = [
    { id: "b1", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "加入 {{dose}} 裂解液。" }] }], execution: { role: "step", stepId: "lyse", format: "block" } },
    { id: "b2", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "再洗一次。" }] }], execution: { role: "step", stepId: "extra", format: "block" } },
  ];
  const snapshot = { versions: [{ protocolVersionId: "v1", protocolTitle: "组织 DNA 提取", displayVersion: "0.1", contentJson: protocol }] };
  // Around noon UTC, so the dates read 2026-10-15 wherever the machine running the tests is (UTC−11 to UTC+11).
  const plan = { schemaVersion: 1, revision: 3, versions: { v1: { selections: { volume: "s" }, actualInputs: {}, confirmedAt: "2026-10-15T11:00:00Z" } }, actualValues: {}, skips: {} };
  const steps = [
    { id: "run-lyse", protocolStepRef: "v1:lyse", groupKey: "v1", groupOrder: 0, order: 1, groupTitle: "PRT-1 · 组织 DNA 提取 · v0.1", title: "加入裂解液", completed: true, completedAt: new Date("2026-10-15T12:00:00Z"),
      deviationNote: "实际加入 360 µL", deviationType: "material", deviationAuthor: "Anna", deviationAt: new Date("2026-10-15T12:05:00Z") },
    { id: "run-extra", protocolStepRef: "v1:extra", groupKey: "v1", groupOrder: 0, order: 2, groupTitle: "PRT-1 · 组织 DNA 提取 · v0.1", title: "再洗一次", completed: false },
  ];
  const record = experimentExecutionDocument(undefined, steps, {}, snapshot, plan);
  const execution = record.sections.find(section => section.key === "execution")!.blocks;
  expect(execution[0]).toMatchObject({ type: "heading", text: "1. 组织 DNA 提取", execution: { role: "group", index: 1, meta: "v0.1 · 已完成 1/1 步" } });
  expect(execution[1]).toMatchObject({ execution: { role: "detail" } });
  expect((execution[1] as { text: string }).text).toMatch(/^本次体系 · 裂解液：▲ 350 µL（确认于 2026-10-15 \d\d:00）$/);
  // The step reads as its body: no repeated derived title, only this run's value.
  expect(execution[2]).toMatchObject({ text: "1. ✓ 偏差（见偏差与事件）", execution: { role: "step", stepId: "run-lyse", number: 1, title: "", completed: true, deviationType: "material" } });
  expect(experimentNarrativeFromDocument(record).steps).toContain("加入 350 µL 裂解液。");
  expect(experimentNarrativeFromDocument(record).steps).not.toContain("600 µL");
  expect(execution.at(-1)).toMatchObject({ text: "2. 再洗一次。", execution: { role: "detail", fold: "其他体系的步骤 · 不适用 · 1 步" } });
  expect(experimentNarrativeFromDocument(record).deviations).toMatch(/^第 1 步 · 材料或试剂 · 实际加入 360 µL · 2026-10-15 \d\d:05 · Anna$/);
  // The record reads as the run: no provenance table or calculation receipts (they stay on the run page).
  expect(execution.find(block => block.id === "run-derived:parameters:0:")).toBeUndefined();
  expect(execution.some(block => block.id.startsWith("run-derived:calculation:"))).toBe(false);
});

it("keeps the Protocol's notes where they were written among the steps, never folded away", async () => {
  const { createEmptyProtocolDocument } = await import("./protocol-document");
  const protocol = createEmptyProtocolDocument();
  protocol.executionConfirmed = true;
  protocol.systems = { schemaVersion: 1, dimensions: [{ id: "volume", label: "裂解液", options: [{ id: "s", label: "350 µL" }, { id: "l", label: "600 µL" }] }], presets: [], restrictions: [], parameters: [],
    rules: [{ id: "only-large", target: "step", targetId: "extra", when: { all: [{ dimensionId: "volume", optionId: "l" }] }, parameterIds: [], optional: false, actualFields: [] }] };
  const paragraph = (id: string, text: string, execution: Record<string, string>) => ({ id, type: "rich_text" as const, nodes: [{ type: "paragraph" as const, content: [{ text }] }], execution: execution as never });
  protocol.sections.find(section => section.key === "steps")!.blocks = [
    paragraph("intro", "全程戴手套。", { role: "info" }),
    paragraph("b1", "加入裂解液。", { role: "step", stepId: "lyse", format: "block" }),
    paragraph("ice", "注：以下步骤在冰上操作。", { role: "info" }),
    paragraph("b2", "再洗一次。", { role: "step", stepId: "extra", format: "block" }),
    paragraph("b3", "离心 5 min。", { role: "step", stepId: "spin", format: "block" }),
  ];
  const snapshot = { versions: [{ protocolVersionId: "v1", protocolTitle: "组织 DNA 提取", displayVersion: "0.1", contentJson: protocol }] };
  const plan = { schemaVersion: 1, revision: 1, versions: { v1: { selections: { volume: "s" }, actualInputs: {}, confirmedAt: "2026-10-15T01:00:00Z" } }, actualValues: {}, skips: {} };
  const step = (id: string, ref: string, order: number) => ({ id, protocolStepRef: `v1:${ref}`, groupKey: "v1", groupOrder: 0, order, groupTitle: "PRT-1 · 组织 DNA 提取 · v0.1", title: "", completed: false });
  const record = experimentExecutionDocument(undefined, [step("run-lyse", "lyse", 1), step("run-extra", "extra", 2), step("run-spin", "spin", 3)], {}, snapshot, plan);
  const execution = record.sections.find(section => section.key === "execution")!.blocks;
  const order = execution.filter(block => ["note", "step"].includes(block.execution?.role ?? "")).map(block => block.execution!.role === "note" ? `注:${"nodes" in block ? block.nodes[0].content[0].text : ""}` : `步骤${block.execution!.number}`);
  // Step 2 is the large system's only: its note still reads before the next step this run does.
  expect(order).toEqual(["注:全程戴手套。", "步骤1", "注:注：以下步骤在冰上操作。", "步骤3"]);
  expect(JSON.stringify(execution)).not.toContain("规程说明与参考");
});

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
    original.sections[3]!.blocks.push({ id: "observations-legacy", type: "text", text: "Legacy observation" });

    const next = appendExperimentObservation(original, {
      id: "run-note-1",
      text: "  Cells remained attached after washing.  ",
      recordedAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(next.sections[3]!.blocks).toEqual([
      { id: "observations-legacy", type: "text", text: "Legacy observation" },
      { id: "run-note-1", type: "text", text: "[2026-08-10T01:02:03.000Z]\nCells remained attached after washing." },
    ]);
    expect(original.sections[3]!.blocks).toHaveLength(1);
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
  expect(text).toContain("✓ 取样");
  expect(text).toContain("偏差：实际延长 5 分钟");
  expect(text).toContain("未完成 检测");
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

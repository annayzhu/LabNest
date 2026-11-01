import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convertLegacyProtocol, isLegacyProtocol } from './protocol-conversion';
import { parseProtocolDocxBytes } from './protocol-docx';
import { exportOrganizedDraftDocx } from './protocol-docx-template';
import { projectProtocolDocument } from './protocol-document';
import { habitTextToDocument } from './protocol-habit-text';
import { checkRecognition, cleanModelText, habitTextProtocol, organizeSource, outlineSource, pageRanges } from './protocol-recognition';
import { defaultChoice, needsConfirmation } from './protocol-recognition-scope';

/** A made-up kit manual: introduction, components, storage, the protocol, a measurement and an FAQ. */
const manual = [
  'XX 总 RNA 提取试剂盒 使用说明书',
  '产品简介：本试剂盒适用于从培养细胞中快速提取高纯度总 RNA。',
  '储存条件：室温保存，有效期 12 个月。',
  '试剂盒组分：Buffer RL 35 mL；Buffer RW1 45 mL；RNase-free 水 10 mL。',
  '操作步骤',
  '1. 收集细胞：样本少于 5×10^6 个细胞时加入 350 µL Buffer RL，5×10^6 至 1×10^7 个细胞时加入 600 µL Buffer RL，涡旋混匀 15 s。',
  '2. 富脂样本另加 200 µL 氯仿，剧烈振荡 15 s。',
  '3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。',
  '4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。',
  '5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。',
  '结果检测：用分光光度计测定 RNA 浓度和 A260/280。',
  '常见问题：RNA 产量低怎么办？请确认样本量不超过 1×10^7 个细胞。',
].join('\n');

const faithful = [
  '标题：XX 总 RNA 提取试剂盒 使用说明书',
  '说明：本试剂盒适用于从培养细胞中快速提取高纯度总 RNA。',
  '材料：',
  '- Buffer RL | 35 mL |',
  '- Buffer RW1 | 45 mL |',
  '- RNase-free 水 | 10 mL |',
  '步骤：',
  '体系：少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞',
  '1. 收集细胞：加入 350/600 µL Buffer RL，涡旋混匀 15 s。',
  '2. 仅富脂样本：另加 200 µL 氯仿，剧烈振荡 15 s。',
  '3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。',
  '4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。',
  '5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。',
  '结果：',
  '记录：RNA 浓度、A260/280',
].join('\n');

const ids = () => { let n = 0; return (prefix: string) => `${prefix}-${++n}`; };

describe('Text written by habit', () => {
  it('reads sections by their usual names, material lines, steps and results', () => {
    const { document, title } = habitTextToDocument(faithful);
    const lines = (key: string) => document.sections.find(section => section.key === key)!.blocks.map(block => block.type === 'table' ? block.rows.map(row => row.join('|')).join(' / ') : 'text' in block ? block.text : block.type);
    expect(title).toBe('XX 总 RNA 提取试剂盒 使用说明书');
    expect(lines('description')).toEqual(['本试剂盒适用于从培养细胞中快速提取高纯度总 RNA。']);
    expect(lines('material')).toEqual(['名称|用量|说明 / Buffer RL|35 mL| / Buffer RW1|45 mL| / RNase-free 水|10 mL|']);
    expect(lines('steps')).toHaveLength(6);
    expect(lines('result_templates')).toEqual(['记录：RNA 浓度、A260/280']);
  });

  it('takes a short first line as the title when no "标题：" line names it', () => {
    expect(habitTextToDocument('XX 总 RNA 提取试剂盒 使用说明书\n1. 加入 PBS 1 mL').title).toBe('XX 总 RNA 提取试剂盒 使用说明书');
    expect(habitTextToDocument('1. 加入 PBS 1 mL\n2. 离心 300 ×g 5 min').title).toBeUndefined();
    expect(habitTextToDocument('注意：全程在冰上操作。\n1. 加入 PBS 1 mL').title).toBeUndefined();
  });

  it('reads plain pasted steps as steps, keeps a later "说明：" inside them and sends "记录：" to the results', () => {
    const { document } = habitTextToDocument('1. 加入 PBS 1 mL\n说明：动作要轻\n2. 离心 300 ×g 5 min\n记录：细胞数');
    const keys = document.sections.filter(section => section.blocks.length).map(section => `${section.key}:${section.blocks.length}`);
    expect(keys).toEqual(['steps:3', 'result_templates:1']);
  });
});

describe('Checking a text without positions against the whole original', () => {
  it('passes a faithful layout, including per-system values gathered from one sentence', () => {
    const check = checkRecognition(faithful, manual);
    expect(check.lines.filter(line => !line.verified)).toEqual([]);
    expect(check.missing).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it('flags a number not in the original, a sentence from nowhere, an invented record item and a dropped step', () => {
    const wrong = faithful.replace('700 µL Buffer RW1', '750 µL Buffer RW1').replace('5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。', '5. 将纯化产物分装后置于超低温冰箱长期保存。').replace('记录：RNA 浓度、A260/280', '记录：RNA 浓度、RIN 值');
    const check = checkRecognition(wrong, manual);
    expect(check.lines.filter(line => !line.verified).map(line => [line.line.slice(0, 12), line.problems.join('；')])).toEqual([
      ['4. 加入 750 µL', '数值不在原文：750'], ['5. 将纯化产物分装后置', expect.stringMatching(/^原文中找不到出处/)], ['记录：RNA 浓度、RI', '记录项原文中找不到：RIN 值'],
    ]);
    // The original 700 µL sentence counts as missing too: the answer replaced its number.
    expect(check.missing).toEqual(['加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液', '加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA']);
    expect(check.ok).toBe(false);
  });
});

/** A three-page English manual: product page, a procedure with two systems, and an appendix for another use. */
const kit = { fileName: 'kit.pdf', title: '质粒提取', goal: '从 100 mL 菌液提取质粒用于转染', pages: [
  { page: 1, lines: ['Plasmid Kit User Guide', 'Use this kit to purify plasmid DNA from E. coli cultures.', 'Store the kit at room temperature. Store Buffer R3 with RNase A at 4 °C.'] },
  { page: 2, lines: ['Procedure', 'Add RNase A to Buffer R3 before first use.', 'Mini: resuspend the pellet in 0.4 mL Buffer R3.', 'Maxi: resuspend the pellet in 10 mL Buffer R3.', 'Centrifuge at 12,000 × g for 10 minutes.', 'Measure the DNA concentration and A260/A280.'] },
  { page: 3, lines: ['Appendix: BAC DNA', 'APPENDIX-ONLY: add 999 µL Buffer X.'] },
] };

const outlineAnswer = JSON.stringify({ parts: [{ pages: '1', label: 'Product', use: '背景' }, { pages: '2', label: 'Procedure', use: '步骤' }, { pages: '3', label: 'Appendix: BAC DNA', use: '不要' }],
  workflows: [], systems: { label: '体系', options: ['Mini', 'Maxi'] }, conflicts: [] });

const answers = {
  front: ['标题：质粒提取（Mini / Maxi）', '说明：', '体系对应：Mini / Maxi〔p2:3–4〕', '目的：', '从 E. coli 培养物中纯化质粒 DNA。〔p1:2〕', '背景：', '储存：试剂盒室温保存；加 RNase A 后的 Buffer R3 于 4 °C 保存。〔p1:3〕'],
  material: ['材料：', '- Buffer R3 | 0.4/10 mL | 含 RNase A，首次使用前加入〔p2:2–4〕'],
  steps: ['步骤：', '体系：Mini / Maxi〔p2:3–4〕', '1. 首次使用前：向 Buffer R3 加入 RNase A。〔p2:2〕', '2. 用 Buffer R3 0.4/10 mL 重悬沉淀。〔p2:3–4〕', '3. 12,000 ×g 离心 10 min。〔p2:5〕'],
  results: ['结果：', 'DNA 质检', '记录：DNA 浓度、A260/A280〔p2:6〕'],
};

/** A fake model: the outline for the first request, then each batch's answer by the layout its request asks for. */
function fakeModel(overrides: Partial<Record<keyof typeof answers, string[][]>> = {}) {
  const sent: { system: string; user: string }[] = [];
  const served: Record<string, number> = {};
  const complete = async (system: string, user: string) => {
    sent.push({ system, user });
    if (system.includes('JSON')) return { text: outlineAnswer, model: 'fake-model' };
    const key = system.includes('只写“标题”') ? 'front' : system.includes('只写“材料”') ? 'material' : system.includes('只写“步骤”') ? 'steps' : 'results';
    const round = served[key] = (served[key] ?? 0) + 1;
    return { text: (overrides[key]?.[round - 1] ?? answers[key]).join('\n'), model: 'fake-model' };
  };
  return { complete, sent };
}

describe('AI 识别 in two passes (template-v1)', () => {
  it('outlines the source from its digest, with the name and the goal, and asks the author to choose the systems', async () => {
    const { complete, sent } = fakeModel();
    const { outline } = await outlineSource(kit, complete);
    expect(sent[0].user).toContain('规程名称：质粒提取');
    expect(sent[0].user).toContain('作者的目标：从 100 mL 菌液提取质粒用于转染');
    expect(outline.parts.map(part => [part.from, part.use])).toEqual([[1, 'background'], [2, 'steps'], [3, 'drop']]);
    expect(needsConfirmation(outline)).toBe(true);
    expect(defaultChoice(outline, 'zh')).toEqual({ systems: ['Mini', 'Maxi'], language: 'zh', dropped: [2] });
  });

  it('writes each section from its own pages, repairs a batch once, and puts the template together', async () => {
    const wrongSteps = answers.steps.map(line => line.replace('0.4/10 mL', '0.5/10 mL'));
    const { complete, sent } = fakeModel({ steps: [wrongSteps] });
    const { outline } = await outlineSource(kit, complete);
    const result = await organizeSource(kit, outline, defaultChoice(outline, 'zh'), complete);
    const prompts = sent.slice(1);
    // The appendix the author left out is never sent; every request carries the name and the goal.
    expect(prompts.some(prompt => prompt.user.includes('APPENDIX-ONLY'))).toBe(false);
    expect(prompts.every(prompt => prompt.user.includes('规程名称：质粒提取') && prompt.user.includes('体系：Mini / Maxi'))).toBe(true);
    expect(prompts.find(prompt => prompt.system.includes('只写“步骤”'))!.user).toContain('[p2:3] Mini: resuspend the pellet in 0.4 mL Buffer R3.');
    expect(prompts.find(prompt => prompt.system.includes('只写“标题”'))!.user).not.toContain('[p2:');
    // The steps came back with 0.5 mL, which p2:3 does not say: one repair round, with the problem named.
    expect(result.calls).toBe(5);
    expect(prompts.at(-1)!.user).toContain('数值不在指向的原文：0.5 mL');
    expect(result.habitText.split('\n')).toEqual([
      '标题：质粒提取', '说明：', '来源：kit.pdf，读取第 1–2 页（共 3 页）', '范围：体系 Mini / Maxi；中文整理（数值、单位、试剂名、货号照原文）；不含：Appendix: BAC DNA（第 3 页）',
      '体系对应：Mini / Maxi〔p2:3–4〕', '目的：', '从 E. coli 培养物中纯化质粒 DNA。〔p1:2〕', '背景：', '储存：试剂盒室温保存；加 RNase A 后的 Buffer R3 于 4 °C 保存。〔p1:3〕',
      ...answers.material, ...answers.steps, ...answers.results,
    ]);
    expect(result.check).toMatchObject({ unverified: 0, missing: [], ok: true });
    expect(result.scope).toEqual({ systems: ['Mini', 'Maxi'], language: 'zh', dropped: [2], pages: [1, 2] });
  });

  it('writes long steps in parts from all their pages, never cutting the source, and numbers them again', async () => {
    const long = (page: number, step: string) => ({ page, lines: [`${step}: add ${page}0 µL Buffer.`, ...Array.from({ length: 400 }, (_, index) => `Note ${page}-${index}: keep the tube closed and on ice while you work.`)] });
    const source = { fileName: 'long.pdf', pages: [long(1, 'First'), long(2, 'Second')] };
    const sent: string[] = [];
    const complete = async (system: string, user: string) => {
      sent.push(user);
      if (system.includes('JSON')) return { text: JSON.stringify({ parts: [{ pages: '1-2', label: 'Procedure', use: '步骤' }], workflows: [], systems: null, conflicts: [] }) };
      if (!system.includes('只写“步骤”')) return { text: '' };
      const page = user.includes('[p1:1]') ? 1 : 2;
      return { text: `步骤：\n1. 加入 ${page}0 µL Buffer。〔p${page}:1〕` };
    };
    const { outline } = await outlineSource(source, complete);
    const result = await organizeSource(source, outline, defaultChoice(outline, 'zh'), complete);
    expect(sent.filter(user => user.includes('分 2 段整理'))).toHaveLength(2);
    expect(sent.some(user => user.includes('[p1:401] Note 1-399')) && sent.some(user => user.includes('[p2:401] Note 2-399'))).toBe(true);
    expect(result.habitText).toContain('步骤：\n1. 加入 10 µL Buffer。〔p1:1〕\n2. 加入 20 µL Buffer。〔p2:1〕');
  });

  it('reads a draft into a Protocol without its positions', () => {
    const draft = ['标题：质粒提取', '说明：', '来源：kit.pdf', ...answers.material, ...answers.steps, ...answers.results].join('\n');
    const { document, summary } = habitTextProtocol(draft, ids());
    expect(JSON.stringify(document)).not.toContain('〔p');
    expect(summary).toMatchObject({ steps: 3, systems: ['体系：Mini / Maxi'], resultTemplates: 1 });
    expect(summary.chips).toContain('0.4/10 mL');
  });

  it('cleans lead-in chatter from an answer', () => {
    expect(cleanModelText('以下是整理结果：\n```\n材料：\n- A | 1 mL〔p1:1〕\n```')).toBe('材料：\n- A | 1 mL〔p1:1〕');
    expect(pageRanges([5, 1, 2, 3, 7, 8])).toBe('1–3、5、7–8');
  });
});

describe('The organized draft as the Word template', () => {
  const draft = ['标题：质粒提取', '说明：', '来源：kit.pdf，读取第 1–2 页（共 3 页）', '目的：', '从 E. coli 培养物中纯化质粒 DNA。〔p1:2〕', ...answers.material, ...answers.steps, ...answers.results].join('\n');
  const reading = (document: ReturnType<typeof habitTextToDocument>['document']) => {
    const { document: converted, summary } = isLegacyProtocol(document) ? convertLegacyProtocol(document, ids()) : { document, summary: undefined };
    const projection = projectProtocolDocument(converted);
    return { steps: projection.steps.map(step => step.title), chips: summary?.chips, systems: summary?.systems, results: projection.resultTemplates.map(template => template.fields.map(field => field.label)) };
  };
  const web = habitTextProtocol(draft, ids());
  const expected = { steps: projectProtocolDocument(web.document).steps.map(step => step.title), chips: web.summary.chips, systems: web.summary.systems, results: projectProtocolDocument(web.document).resultTemplates.map(template => template.fields.map(field => field.label)) };

  it('downloads without positions and imports back to the same Protocol, unchanged or edited in Word', () => {
    const { bytes, filename } = exportOrganizedDraftDocx(draft, '质粒提取');
    expect(filename).toBe('PRT-UNASSIGNED_质粒提取_v0.1_Draft.docx');
    const files = unzipSync(bytes);
    expect(strFromU8(files['word/document.xml'])).not.toContain('〔p');
    const unchanged = parseProtocolDocxBytes(bytes, filename);
    expect(unchanged.canonicalTitle).toBe('质粒提取');
    expect(reading(unchanged.document)).toEqual(expected);
    // Saved again by Word: LabNest's own record no longer matches, so the visible text is read.
    const edited = zipSync({ ...Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'word/labnest-protocol.json')), 'word/document.xml': strToU8(strFromU8(files['word/document.xml'])) });
    expect(reading(parseProtocolDocxBytes(edited, filename).document)).toEqual(expected);
  });
});

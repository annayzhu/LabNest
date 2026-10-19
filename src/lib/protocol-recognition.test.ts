import { describe, expect, it } from 'vitest';
import { habitTextToDocument } from './protocol-habit-text';
import { checkRecognition, cleanModelText, habitTextProtocol, recognizeProtocolText } from './protocol-recognition';

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

describe('Checking a laid-out text against the original', () => {
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

describe('AI 识别 with one repair round', () => {
  it('sends the problems back once and keeps the corrected layout', async () => {
    const sent: string[] = [];
    const answers = [`以下是整理结果：\n\`\`\`\n${faithful.replace('700 µL', '750 µL')}\n\`\`\``, faithful];
    const result = await recognizeProtocolText(manual, async (_system, user) => { sent.push(user); return { text: answers[sent.length - 1], model: 'fake-model' }; });
    expect(result).toMatchObject({ attempts: 2, model: 'fake-model', truncated: false, habitText: faithful });
    expect(result.check.ok).toBe(true);
    expect(sent[1]).toContain('数值不在原文：750');
    expect(cleanModelText(answers[0]).startsWith('标题：')).toBe(true);
  });

  it('checks a long manual only against the part the model was given', async () => {
    const beyond = Array.from({ length: 30 }, (_, index) => `${index + 1}. 加入 ${index + 101} µL 试剂 ${index + 1}。`).join('\n');
    const long = `${manual}\n${'附录。'.repeat(11_000)}\n${beyond}`;
    const result = await recognizeProtocolText(long, async () => ({ text: faithful }));
    expect(result).toMatchObject({ truncated: true, attempts: 1 });
    expect(result.check.missing).toEqual([]);
  });

  it('turns the layout into step blocks, a system, a scoped step and a result template', () => {
    const { document, summary, title } = habitTextProtocol(faithful, ids());
    expect(title).toBe('XX 总 RNA 提取试剂盒 使用说明书');
    expect(summary).toMatchObject({ steps: 5, systems: ['体系：少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞'], conditions: ['第 2 步 · 仅富脂样本'], recordLines: 1, resultTemplates: 1 });
    expect(summary.chips).toContain('350/600 µL');
    const template = document.sections.find(section => section.key === 'result_templates')!.blocks[0];
    expect(template.type === 'table' && template.resultTemplate?.fields.map(field => [field.label, field.dataType])).toEqual([['RNA 浓度', 'number'], ['A260/280', 'number']]);
  });
});

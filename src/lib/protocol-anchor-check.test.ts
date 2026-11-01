import { describe, expect, it } from 'vitest';
import { checkAnchoredRecognition } from './protocol-anchor-check';
import { amountsIn, foldAmounts, identifiersIn, latinNamesIn, pagedLines, readAnchors, resolveAnchors, stripAnchors } from './protocol-anchors';

/** A made-up kit manual on two pages: what the organized lines below cite. */
const pages = [
  { page: 1, lines: [
    'XX 总 RNA 提取试剂盒 使用说明书',
    '储存条件：室温保存，有效期 12 个月。',
    '试剂盒组分：Buffer RL 35 mL；Buffer RW1 45 mL；RNase-free 水 10 mL。',
    '操作步骤',
    '1. 收集细胞：样本少于 5×10^6 个细胞时加入 350 µL Buffer RL，5×10^6 至 1×10^7 个细胞时加入 600 µL Buffer RL，涡旋混匀 15 s。',
    '2. 富脂样本另加 200 µL 氯仿，剧烈振荡 15 s。',
    '3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。',
  ] },
  { page: 2, lines: [
    '4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。',
    '5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。',
    '结果检测：用分光光度计测定 RNA 浓度和 A260/280。',
  ] },
];

const organized = [
  '标题：XX 总 RNA 提取试剂盒',
  '说明：',
  '来源：kit.pdf，第 1–2 页',
  '材料：',
  '- Buffer RL | 350/600 µL | 试剂盒内 35 mL〔p1:3, p1:5〕',
  '步骤：',
  '体系：少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞〔p1:5〕',
  '1. 加入 Buffer RL 350/600 µL，涡旋混匀 15 s。〔p1:5〕',
  '2. 仅富脂样本：另加 200 µL 氯仿，剧烈振荡 15 s。〔p1:6〕',
  '3. 12,000 ×g 离心 2 min，上清转入吸附柱。〔p1:7〕',
  '4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。〔p2:1〕',
  '5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。〔p2:2〕',
  '结果：',
  'RNA 质检',
  '记录：RNA 浓度、A260/280〔p2:3〕',
].join('\n');

const failing = (text: string) => checkAnchoredRecognition(text, pages).lines.filter(line => !line.verified).map(line => [line.line.slice(0, 8), line.problems.join('；')]);

describe('Source positions', () => {
  it('reads one position, several, a range and a range across a page break', () => {
    expect(readAnchors('1. 加入 350 µL Buffer RL。〔p1:5〕')).toEqual({ text: '1. 加入 350 µL Buffer RL。', ranges: [{ page: 1, from: 5, to: 5 }] });
    expect(readAnchors('- R3 | 0.4/4/10 mL〔p16:5, p20:7–8〕').ranges).toEqual([{ page: 16, from: 5, to: 5 }, { page: 20, from: 7, to: 8 }]);
    expect(readAnchors('洗涤 [p3:40-p4:2]').ranges).toEqual([{ page: 3, from: 40, to: Number.MAX_SAFE_INTEGER }, { page: 4, from: 1, to: 2 }]);
    expect(stripAnchors('1. 加入 PBS。〔p1:2〕\n说明：\n2. 离心〔p1:3–4〕')).toBe('1. 加入 PBS。\n说明：\n2. 离心');
  });

  it('finds the cited lines in page order and reports positions that do not exist', () => {
    const { lines, absent } = resolveAnchors(readAnchors('〔p2:1, p1:6–7, p3:1, p1:9〕').ranges, pages);
    expect(lines.map(line => `${line.page}:${line.line}`)).toEqual(['1:6', '1:7', '2:1']);
    expect(absent).toEqual(['p3:1', 'p1:9']);
  });

  it('pages text at form feeds and numbers its non-empty lines', () => {
    expect(pagedLines('a\n\n b \fc')).toEqual([{ page: 1, lines: ['a', 'b'] }, { page: 2, lines: ['c'] }]);
    expect(pagedLines('')).toEqual([{ page: 1, lines: [] }]);
  });
});

describe('Reading amounts the way the check compares them', () => {
  it('mends what PDFs garble and keeps powers as powers', () => {
    expect(foldAmounts('Dilute 1OX AR6 buffer; 300 μI of water; 37oC; 65 C for 1 hour')).toBe('Dilute 10X AR6 buffer; 300 μl of water; 37 °C; 65 °C for 1 hour');
    expect(foldAmounts('7 × 10⁵ cells, 5×10^6, 12,000 ×g')).toBe('7e5 cells, 5e6, 12000 ×g');
  });

  it('gives each number its unit, ranges and per-system runs included', () => {
    const read = (text: string) => amountsIn(text).quantities.map(quantity => `${quantity.value}${quantity.unit}`);
    expect(read('加入 350/600 µL Buffer RL，涡旋 15 s')).toEqual(['350μl', '600μl', '15s']);
    expect(read('incubate 12-15 hours; 4,000 × g for 10 min; wash 3 x 2 min; 10X AR6; 0.4 / 4 / 10 mL')).toEqual(['12h', '15h', '4000xg', '10min', '3', '2min', '10x', '0.4ml', '4ml', '10ml']);
    expect(amountsIn('R3 0.4 / 4 / 10 mL，TE 1–3 / 15–25 / 100–200 mL').runs.map(run => [run.shown, run.values.join(' ')])).toEqual([['0.4/4/10 mL', '0.4 4 10'], ['1–3/15–25/100–200 mL', '1 3 15 25 100 200']]);
  });

  it('tells names with digits from amounts, and Latin names from units', () => {
    expect(identifiersIn('HiPure 柱 K2100-02，Buffer RW1，pLKO.1，FBS 15140-122，10X AR6，5 min')).toEqual(['K2100-02', 'RW1', 'pLKO.1', '15140-122', 'AR6']);
    expect(latinNamesIn('加入 Opti-MEM 74 µL 与 FuGENE® 6，37 °C 孵育 15 min（Ms+Rb）')).toEqual(['Opti-MEM', 'FuGENE', 'Ms+Rb']);
  });
});

describe('锚点核对', () => {
  it('passes a faithful draft and lists nothing as left out', () => {
    const check = checkAnchoredRecognition(organized, pages);
    expect(check.lines.filter(line => !line.verified)).toEqual([]);
    expect(check.lines).toHaveLength(8);
    expect(check.missing).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it('catches the 350/600 swap on both lines that carry it', () => {
    expect(failing(organized.replaceAll('350/600 µL', '600/350 µL'))).toEqual([
      ['- Buffer', '体系取值顺序与原文不一致：600/350 µL'],
      ['1. 加入 Bu', '体系取值顺序与原文不一致：600/350 µL'],
    ]);
  });

  it('accepts one amount written for every system, which the original states once', () => {
    expect(checkAnchoredRecognition('材料：\n- Buffer RW1 | 700/700 µL | 试剂盒内 45 mL〔p1:3, p2:1〕', pages).lines[0]).toMatchObject({ verified: true });
  });

  it('catches two lines whose amounts were swapped, though both amounts are elsewhere in the manual', () => {
    const swapped = organized.replace('4. 加入 700 µL', '4. 加入 50 µL').replace('5. 加入 50 µL', '5. 加入 700 µL');
    expect(failing(swapped)).toEqual([['4. 加入 50', '数值不在指向的原文：50 µL'], ['5. 加入 70', '数值不在指向的原文：700 µL']]);
  });

  it('flags a line without a position, a position that does not exist, and a name not in the cited line', () => {
    const wrong = organized.replace('3. 12,000 ×g 离心 2 min，上清转入吸附柱。〔p1:7〕', '3. 12,000 ×g 离心 2 min，上清转入吸附柱。')
      .replace('〔p2:2〕', '〔p2:9〕').replace('700 µL Buffer RW1', '700 µL Buffer RW2');
    expect(failing(wrong)).toEqual([
      ['3. 12,00', '没有原文位置'],
      ['4. 加入 70', '名称不在指向的原文：RW2'],
      ['5. 加入 50', '原文位置不存在：p2:9'],
    ]);
  });

  it('lists an amount line cited by no line as possibly left out, within the organized pages only', () => {
    const dropped = organized.split('\n').filter(line => !line.startsWith('2. 仅富脂')).join('\n');
    expect(checkAnchoredRecognition(dropped, pages).missing).toEqual(['〔p1:6〕 2. 富脂样本另加 200 µL 氯仿，剧烈振荡 15 s。']);
    expect(checkAnchoredRecognition(dropped, pages, { scopePages: [2] }).missing).toEqual([]);
  });

  it('checks a Chinese line against an English source by its amounts and names, and an English line by its words too', () => {
    const english = [{ page: 1, lines: ['A. For each plasmid to be transfected, plate 7×105 HEK-293T cells in 5 mL of media in a 6 cm tissue culture plate.', 'Incubate cells at 37oC, 5% CO2 overnight.', 'Spin media at 1,250 rpm for 5 minutes to pellet any HEK-293T cells.'] }];
    const check = (line: string) => checkAnchoredRecognition(`步骤：\n${line}`, english).lines[0];
    expect(check('1. 将 7 × 10⁵ HEK293T 细胞铺于 6 cm 皿，加入 5 mL 培养基；37°C、5% CO₂ 过夜。〔p1:1–2〕')).toMatchObject({ verified: true });
    expect(check('2. 1,250 rpm 离心 5 min，去除 HEK293T 细胞。〔p1:3〕')).toMatchObject({ verified: true });
    expect(check('2. 1,500 rpm 离心 5 min，去除 293FT 细胞。〔p1:3〕').problems).toEqual(['数值不在指向的原文：1500 rpm', '名称不在指向的原文：293FT']);
    expect(check('2. Spin at 1,250 rpm for 5 minutes, then freeze the supernatant in liquid nitrogen overnight.〔p1:3〕').problems).toEqual([expect.stringMatching(/^与指向的原文只对上 \d+%$/)]);
  });
});

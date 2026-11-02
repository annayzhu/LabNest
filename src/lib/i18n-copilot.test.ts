import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';

describe('The research plan Copilot in Chinese', () => {
  it.each([
    ['Copilot for this plan', '本方案的 Copilot'],
    ['Split the question', '拆科学问题'],
    ['Unverified', '未验证'],
    ['Adopt', '采纳'],
    ['Starting sends your purpose and its keywords to the AI service and Europe PMC, about 32 model calls. You can stop at any time.', '点“开始”会把研究目的和关键词发给 AI 服务和 Europe PMC，约调用模型 32 次，随时可以停止。'],
    ['Model calls so far: 5 · deepseek-v4', '到目前为止调用了模型 5 次 · deepseek-v4'],
    ['Questions (4)', '科学问题（4）'],
    ['Run log (12)', '运行记录（12）'],
    ['Question q2', '问题 q2'],
    ['search finished', '查文献阶段完成'],
    ['20 papers chosen of 31 found', '找到 31 篇，选了 20 篇'],
    ['Reading paper 3 of 20: Gene A drives growth', '正在读第 3 / 20 篇：Gene A drives growth'],
    ['6 experiments (4 with a verified quote)', '6 个实验（4 个引文已核实）'],
    ['Paper 2 could not be read: Europe PMC is busy', '第 2 篇没能读完：Europe PMC is busy'],
  ])('%s', (english, chinese) => expect(translateUiText(english, 'zh')).toBe(chinese));
});

describe('The design workbench sign-off in Chinese', () => {
  it.each([
    ['Needs a group and a readout: Transwell 迁移', '至少要有一个分组和一项读出：Transwell 迁移'],
    ['Changed after review round 1, review again: 敲低验证, Transwell 迁移', '第 1 轮审查之后改过，请再审查一轮：敲低验证、Transwell 迁移'],
    ['Changed after the last review and not reviewed again: Transwell 迁移. Signing writes this into the limitations.', '最后一轮审查之后改过、没有再审查：Transwell 迁移。签署时会写进“限制与依赖”。'],
  ])('%s', (english, chinese) => expect(translateUiText(english, 'zh')).toBe(chinese));
});

describe('Adoption numbers and 整理 in Chinese', () => {
  it.each([
    ['Copilot, last 30 days: adopted 3 of 4 (75%) · 1.5 fields changed before adopting · 2 waiting · set aside: Poorly written 1', 'Copilot 最近 30 天：采纳 3/4（75%） · 采纳前平均改 1.5 处 · 2 条待处理 · 未采用：写法不好 1'],
    ['Copilot, last 30 days: none decided yet · 1 waiting', 'Copilot 最近 30 天：还没有处理过 · 1 条待处理'],
    ['Research plans · Design card · v1', '研究方案 · 设计卡 · 第 1 版'],
    ['Quick records · Tidied quick record · v1', '快速记录 · 整理快速记录 · 第 1 版'],
    ['Tidy up', '整理'],
    ['Use this draft', '采用'],
    ['Original words', '原话'],
    ['Not in your words: 48, EXP-0013. Check them before adopting.', '原话里没有：48、EXP-0013。采用前请核对。'],
    ['Your words name EXP-0012 Transwell 迁移. File this record under it?', '原话提到了 EXP-0012 Transwell 迁移。把这条记录归入它吗？'],
    ['From DeepSeek (deepseek-v4-flash). Nothing on the record changes until you adopt it; the words as they are now stay under “Original words”.', '来自 DeepSeek (deepseek-v4-flash)。采用之前记录不会改变；现在的文字会保留在“原话”里。'],
    ['Tidy up a quick record', '整理快速记录'],
  ])('%s', (english, chinese) => expect(translateUiText(english, 'zh')).toBe(chinese));
});

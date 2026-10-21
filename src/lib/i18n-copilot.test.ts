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

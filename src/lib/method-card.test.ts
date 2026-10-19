import { describe, expect, it } from 'vitest';
import { buildMethodCardPrompt, checkMethodCard, manualMethodCard, methodCardSchema, parseMethodCard } from './method-card';

const source = `Materials\nProteinase K (20 mg/mL), Buffer ATL.\n\nStep 1\nAdd 20 µL Proteinase K to 180 µL Buffer ATL and incubate at 56 °C for 1 h, or until the tissue is completely lysed.\n\nStep 2\nAdd 200 µL Buffer AL, vortex, then add 200 µL ethanol.`;

describe('方法卡', () => {
  it('parses the model output even when it is fenced, and marks statements whose quote is not in the text', () => {
    const raw = parseMethodCard('```json\n' + JSON.stringify({
      summary: '柱式提取组织 DNA', duration: '约 2 h',
      applicability: [{ text: '适用于动物组织', quote: 'until the tissue is completely lysed' }],
      keyParameters: [{ text: 'Proteinase K 20 µL', quote: 'Add 20 µL Proteinase K' }, { text: '56 °C 裂解 1 h', quote: 'incubate at 56 °C for 1 h' }, { text: '乙醇 300 µL', quote: 'add 300 µL ethanol' }],
      materials: [{ text: 'Buffer ATL', quote: 'Buffer ATL' }],
      risks: [{ text: '裂解不完全会降低产量', quote: '' }],
    }) + '\n```');
    const card = checkMethodCard(raw, source, { provider: 'test', model: 'm' });
    expect(card.keyParameters.map(item => item.verified)).toEqual([true, true, false]);
    expect(card.applicability[0].verified).toBe(true);
    // An empty quote is no evidence.
    expect(card.risks[0].verified).toBe(false);
    expect(card.unverified).toBe(2);
    expect(card.sampleRequirements).toEqual([]);
    expect(card).toMatchObject({ provider: 'test', model: 'm', summary: '柱式提取组织 DNA', duration: '约 2 h' });
  });

  it('marks a statement whose numbers are not in its own quote, and says why each one is unverified', () => {
    const card = checkMethodCard(methodCardSchema.parse({
      keyParameters: [{ text: '56 °C 裂解 2 h', quote: 'incubate at 56 °C for 1 h' }, { text: 'Proteinase K 20 µL', quote: 'Add 20 µL Proteinase K' }],
      materials: [{ text: 'Buffer AL', quote: 'Buffer AL from another kit' }],
      risks: [{ text: '裂解不完全会降低产量', quote: '' }],
    }), source);
    expect(card.keyParameters.map(item => [item.verified, item.problem])).toEqual([[false, '数值不在引文中：2'], [true, undefined]]);
    expect(card.materials[0]).toMatchObject({ verified: false, problem: '引文不在原文中' });
    expect(card.risks[0]).toMatchObject({ verified: false, problem: '没有引文' });
    expect(card.unverified).toBe(3);
  });

  it('ignores case, quotes and whitespace when matching, and rejects output that is not a card', () => {
    const card = checkMethodCard(parseMethodCard('{"materials":[{"text":"Buffer AL","quote":"buffer  al,   vortex"}]}'), source);
    expect(card.materials[0].verified).toBe(true);
    expect(() => parseMethodCard('{"materials": "Buffer AL"}')).toThrow();
    expect(() => parseMethodCard('no json here')).toThrow();
  });

  it('builds a prompt that carries the goal, conditions and the text, truncating very long texts', () => {
    const prompt = buildMethodCardPrompt({ goal: 'KYSE150 敲低效率验证', sampleType: '细胞', conditions: '20 µL 体系', title: 'qPCR', text: 'x'.repeat(30_000) });
    expect(prompt.user).toContain('研究目标：KYSE150 敲低效率验证');
    expect(prompt.user).toContain('[文本已截断]');
    expect(prompt.truncated).toBe(true);
    expect(prompt.system).toContain('逐字摘录');
  });

  it('keeps a hand-written card as the author’s own statements', () => {
    const card = manualMethodCard(' 自家方法 ', { keyParameters: ['56 °C 1 h', ' '], materials: ['Buffer ATL'] });
    expect(card).toMatchObject({ summary: '自家方法', unverified: 0, byHand: true, keyParameters: [{ text: '56 °C 1 h', verified: true }], materials: [{ text: 'Buffer ATL', verified: true }], risks: [] });
  });
});

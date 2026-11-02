import { describe, expect, it } from 'vitest';
import { brokenCards, srgnCards, srgnChain } from './fixtures';
import { blockingRules, checkCards } from './rules';
import { chainTemplates, suggestTemplate } from './templates';

const rules = (cards = srgnCards, tier: 'light' | 'standard' | 'publication' = 'standard') => checkCards(cards, srgnChain, tier).map(finding => `${finding.rule}:${finding.blockId}`);

describe('design rules', () => {
  it('pass a complete knockdown design', () => {
    expect(rules()).toEqual([]);
  });

  it('catch the deliberately broken designs', () => {
    expect(rules(brokenCards.noNc)).toEqual(['1:kd-check', '1:phenotype']);
    expect(rules(brokenCards.wellsAsN)).toEqual(['5:kd-check', '5:phenotype']);
    // The rescue block is in the chain, so one siRNA is allowed only because it exists.
    expect(rules(brokenCards.oneSiRna)).toEqual([]);
    expect(checkCards(brokenCards.oneSiRna, { ...srgnChain, blocks: srgnChain.blocks.filter(block => block.id !== 'rescue') }, 'standard').map(finding => finding.rule)).toEqual([3, 3]);
  });

  it('read method names by their synonyms', () => {
    const [kd] = srgnCards;
    const findings = checkCards([{ ...kd, readouts: [{ name: '免疫印迹', method: '', timepoint: '', assay: 'other' }, { name: 'RT-PCR', method: '荧光定量 PCR', timepoint: '', assay: 'other' }], referenceGenes: ['GAPDH'], loadingControl: '' }], srgnChain, 'standard');
    expect(findings.map(finding => finding.rule)).toEqual([8, 9]);
  });

  it('flag a phenotype read before the manipulation is verified', () => {
    const [, phenotype] = srgnCards;
    expect(checkCards([{ ...phenotype, dependsOn: [] }], { ...srgnChain, blocks: srgnChain.blocks.map(block => ({ ...block, dependsOn: [] })) }, 'standard').map(finding => finding.rule)).toEqual([2]);
  });

  it('flag pseudo-n, missing correction, missing criteria and empty groups', () => {
    const [kd] = srgnCards;
    const findings = checkCards([{ ...kd, analysis: { ...kd.analysis, multipleComparison: '' }, criteria: [], groups: [...kd.groups, { name: 'mock', treatment: '', control: true }], replicates: { biological: 2, technical: 3, note: '' } }], srgnChain, 'standard');
    expect(findings.map(finding => [finding.rule, finding.severity])).toEqual([[6, 'minor'], [7, 'important'], [11, 'serious'], [12, 'important']]);
    expect(blockingRules(findings).map(finding => finding.rule)).toEqual([11]);
    expect(blockingRules(findings, { 'r11:kd-check': 'criteria are in the protocol' })).toEqual([]);
  });
});

describe('chain templates', () => {
  it('cover the eight claim kinds, each with evidence, controls, alternatives and ordered blocks', () => {
    expect(chainTemplates.map(template => template.id)).toEqual(['knockdown', 'overexpression', 'rescue', 'interaction', 'direct_binding', 'localization', 'pathway', 'association']);
    for (const template of chainTemplates) {
      expect(template.minimumEvidence.length && template.requiredControls.length && template.alternatives.length).toBeTruthy();
      const ids = template.blocks.map(block => block.id);
      for (const [index, block] of template.blocks.entries()) for (const dep of block.dependsOn ?? []) expect(ids.indexOf(dep)).toBeLessThan(index);
    }
  });

  it('start from what the author wrote, then from the claim type', () => {
    expect(suggestTemplate('SRGN siRNA 敲低对迁移的影响', 'necessity').id).toBe('knockdown');
    expect(suggestTemplate('回补实验验证 SRGN', 'necessity').id).toBe('rescue');
    expect(suggestTemplate('SRGN 与 CD44 的 Co-IP', '').id).toBe('interaction');
    expect(suggestTemplate('ligand blot 检测结合', 'direct_binding').id).toBe('direct_binding');
    expect(suggestTemplate('SRGN 的作用', 'sufficiency').id).toBe('overexpression');
  });
});

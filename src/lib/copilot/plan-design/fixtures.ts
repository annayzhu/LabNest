import { chainSchema, contextCardSchema, designCardSchema, type Chain, type ContextCard, type DesignCard } from './spec';

/**
 * A worked design (SRGN knockdown and KYSE150 migration) that passes every rule, and the deliberately broken variants
 * the review must catch (Q308): no NC siRNA, wells counted as n, one siRNA without rescue. Tests and the browser
 * check share them.
 */
export const srgnContext: ContextCard = contextCardSchema.parse({
  question: 'SRGN 敲低是否抑制 KYSE150 细胞迁移', claimType: 'necessity', subject: 'SRGN', modelSystem: 'KYSE150（食管鳞癌细胞系）',
  resourcesHave: 'KYSE150 细胞；SRGN 抗体', resourcesCanGet: 'SRGN siRNA 两条；NC siRNA', resourcesLack: '抗 siRNA 的 SRGN 表达质粒',
  success: '两条 siRNA 都使 Transwell 迁移细胞数下降', states: {},
});

export const srgnChain: Chain = chainSchema.parse({
  claim: 'SRGN 是 KYSE150 细胞迁移所必需的', hypothesis: 'SRGN 敲低降低 KYSE150 迁移', rationale: '前期结果显示 SRGN 在高迁移亚群中表达更高',
  minimumEvidence: ['mRNA 与蛋白水平的敲低验证', '两条独立 siRNA 表型一致', 'NC 对照'],
  alternatives: [{ text: 'siRNA 脱靶', exclude: true }, { text: '增殖差异混杂迁移', exclude: true }],
  blocks: [
    { id: 'kd-check', title: '敲低效率验证（qPCR + WB）', kind: 'manipulation', minTier: 'light', success: '两条 siRNA 敲低 ≥ 70%' },
    { id: 'phenotype', title: 'Transwell 迁移', kind: 'phenotype', minTier: 'light', success: '两条 siRNA 的迁移数均低于 NC', dependsOn: ['kd-check'] },
    { id: 'rescue', title: '拯救实验', kind: 'specificity', minTier: 'publication', success: '回补后迁移恢复', dependsOn: ['phenotype'] },
  ],
  recommendedTier: 'standard',
});

const base = {
  unit: { experimental: '一孔细胞', analysis: '一次独立转染', nCounts: 'biological' },
  groups: [{ name: 'NC', treatment: 'NC siRNA 50 nM', control: true }, { name: 'si-1', treatment: 'SRGN siRNA#1 50 nM' }, { name: 'si-2', treatment: 'SRGN siRNA#2 50 nM' }],
  controls: [{ name: 'NC siRNA', kind: 'negative', excludes: '转染本身的影响', concurrent: true }],
  manipulation: { kind: 'knockdown', independentReagents: 2, efficiencyCheck: '' },
  replicates: { biological: 3, technical: 3, note: '' },
  analysis: { test: '单因素方差分析', primaryComparison: 'si-1、si-2 分别与 NC 比较', multipleComparison: 'Dunnett 校正', exclusion: '' },
  criteria: ['两条 siRNA 的结果都满足成功标准'],
};
export const srgnCards: DesignCard[] = [
  designCardSchema.parse({ ...base, blockId: 'kd-check', title: '敲低效率验证（qPCR + WB）', readouts: [{ name: 'SRGN mRNA', method: 'RT-qPCR', timepoint: '48 h', assay: 'qpcr' }, { name: 'SRGN 蛋白', method: 'Western blot', timepoint: '72 h', assay: 'western_blot' }], referenceGenes: ['GAPDH', 'ACTB'], loadingControl: 'β-actin', normalization: 'SRGN / β-actin 灰度比' }),
  designCardSchema.parse({ ...base, blockId: 'phenotype', title: 'Transwell 迁移', dependsOn: ['kd-check'], readouts: [{ name: '迁移细胞数', method: 'Transwell，结晶紫染色后拍照计数', timepoint: '24 h', assay: 'migration' }], blinding: '计数者不知道分组' }),
];

export const brokenCards = {
  noNc: srgnCards.map(card => ({ ...card, controls: [] })),
  wellsAsN: srgnCards.map(card => ({ ...card, unit: { ...card.unit, nCounts: 'wells' as const } })),
  oneSiRna: srgnCards.map(card => ({ ...card, manipulation: { ...card.manipulation, independentReagents: 1 } })),
};

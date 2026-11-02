import type { BlockKind, ClaimType, Tier } from './spec';

/**
 * Evidence-chain templates (Q302), version 1. Each one states the least evidence a claim of its kind needs, the controls
 * that evidence requires and the usual counter-explanations, so a design is not built from whatever papers turned up.
 * The model adapts a template to the study; it never starts from nothing. Wording keeps the distinctions the Copilot
 * already drew: co-occurrence on a membrane, association in a complex, direct binding and a causal effect are four claims.
 */
export type ChainTemplate = {
  id: string; version: number; label: string; claimTypes: ClaimType[]; keywords: RegExp;
  minimumEvidence: string[]; requiredControls: string[]; alternatives: string[];
  blocks: { id: string; title: string; kind: BlockKind; minTier: Tier; success: string; dependsOn?: string[] }[];
};

export const chainTemplates: ChainTemplate[] = [
  {
    id: 'knockdown', version: 1, label: '基因功能（敲低）', claimTypes: ['necessity'], keywords: /敲低|沉默|knock-?down|si-?RNA|sh-?RNA|antisense|ASO/i,
    minimumEvidence: ['敲低效率在 mRNA 和蛋白两个水平都得到验证', '至少两条独立的 siRNA 或 shRNA 得到一致的表型', '同期的阴性对照（NC siRNA / 非靶向 shRNA）', '推荐：拯救实验（抗 siRNA 的表达构建）'],
    requiredControls: ['NC siRNA 或非靶向 shRNA', '转染试剂（mock）对照', '未处理细胞（可选）'],
    alternatives: ['siRNA 脱靶效应', '转染本身的毒性或应激', '细胞增殖差异造成的表型（如迁移被增殖混杂）', '抗体非特异，敲低验证不可信', 'qPCR 参照基因不稳定'],
    blocks: [
      { id: 'baseline', title: '基线表达', kind: 'baseline', minTier: 'publication', success: '目标在所选细胞中有可检测的表达' },
      { id: 'kd-check', title: '敲低效率验证（qPCR + WB）', kind: 'manipulation', minTier: 'light', success: '两条 siRNA 在 mRNA 与蛋白水平均明显降低（阈值预先写定）' },
      { id: 'phenotype', title: '表型检测', kind: 'phenotype', minTier: 'light', success: '两条 siRNA 的表型方向一致，与 NC 相比差异达到预先写定的标准', dependsOn: ['kd-check'] },
      { id: 'rescue', title: '拯救实验', kind: 'specificity', minTier: 'standard', success: '回补抗 siRNA 的表达构建后表型部分或完全恢复', dependsOn: ['phenotype'] },
      { id: 'mechanism', title: '下游机制', kind: 'mechanism', minTier: 'publication', success: '下游读出随敲低改变，并能被拯救', dependsOn: ['phenotype'] },
    ],
  },
  {
    id: 'overexpression', version: 1, label: '基因功能（过表达）', claimTypes: ['sufficiency'], keywords: /过表达|over-?express|转染质粒|慢病毒|lentivir/i,
    minimumEvidence: ['过表达在蛋白水平得到验证，表达量记录在案', '空载体对照', '表达量不过度：最好有剂量或两种表达水平', '推荐：功能失活突变体作对照'],
    requiredControls: ['空载体', '等量转染的无关蛋白（可选）', '失活突变体（推荐）'],
    alternatives: ['非生理的高表达造成的假象', '标签或融合蛋白本身的影响', '转染或病毒感染的毒性', '克隆间差异（稳转株）'],
    blocks: [
      { id: 'oe-check', title: '过表达验证（WB）', kind: 'manipulation', minTier: 'light', success: '目标蛋白明显高于空载体，表达水平记录' },
      { id: 'phenotype', title: '表型检测', kind: 'phenotype', minTier: 'light', success: '与空载体相比差异达到预先写定的标准', dependsOn: ['oe-check'] },
      { id: 'mutant', title: '失活突变体或剂量对照', kind: 'specificity', minTier: 'standard', success: '突变体不产生表型，或表型随表达量变化', dependsOn: ['phenotype'] },
      { id: 'mechanism', title: '下游机制', kind: 'mechanism', minTier: 'publication', success: '下游读出随过表达改变', dependsOn: ['phenotype'] },
    ],
  },
  {
    id: 'rescue', version: 1, label: '拯救', claimTypes: ['necessity', 'mechanism'], keywords: /拯救|回补|rescue|complement/i,
    minimumEvidence: ['先有可重复的敲低或敲除表型', '回补构建抵抗原有的 siRNA 或 sgRNA', '回补的表达水平接近内源', '空载体回补作对照'],
    requiredControls: ['敲低 + 空载体', '敲低 + 回补', 'NC + 空载体', 'NC + 回补（检查过表达本身的影响）'],
    alternatives: ['回补过量造成新的表型', '回补构建仍被 siRNA 降解', '表型来自脱靶而回补无关'],
    blocks: [
      { id: 'construct', title: '回补构建验证', kind: 'manipulation', minTier: 'light', success: '回补在敲低背景下表达，且抵抗 siRNA' },
      { id: 'rescue', title: '拯救实验（2×2 设计）', kind: 'specificity', minTier: 'light', success: '敲低 + 回补的表型回到 NC 水平附近', dependsOn: ['construct'] },
      { id: 'mutant-rescue', title: '突变体回补', kind: 'mechanism', minTier: 'publication', success: '失活突变体不能拯救', dependsOn: ['rescue'] },
    ],
  },
  {
    id: 'interaction', version: 1, label: '蛋白相互作用', claimTypes: ['interaction'], keywords: /相互作用|共沉淀|Co-?IP|pull-?down|免疫沉淀|interact|PLA|邻近/i,
    minimumEvidence: ['双向的免疫共沉淀（或一向 + 内源）', 'IgG 或同型对照', '输入（input）对照', '说明是复合物中的关联，而不是直接结合'],
    requiredControls: ['IgG / 同型对照', 'input', '空载体或无关标签蛋白', '核酸酶处理（排除经核酸桥接）'],
    alternatives: ['抗体交叉反应', '裂解后人为结合（细胞裂解中的再结合）', '经 DNA/RNA 桥接的间接关联', '过表达造成的非生理结合'],
    blocks: [
      { id: 'expression', title: '两种蛋白在同一体系中的表达', kind: 'baseline', minTier: 'standard', success: '两种蛋白在所选细胞中都可检测' },
      { id: 'co-ip', title: '免疫共沉淀（双向）', kind: 'phenotype', minTier: 'light', success: '两个方向都能沉淀出对方，IgG 对照阴性' },
      { id: 'specificity', title: '特异性对照（核酸酶、无关蛋白）', kind: 'specificity', minTier: 'standard', success: '核酸酶处理后关联仍在，无关蛋白不被沉淀', dependsOn: ['co-ip'] },
      { id: 'domain', title: '结构域定位', kind: 'mechanism', minTier: 'publication', success: '截短体能定位到负责的结构域', dependsOn: ['co-ip'] },
    ],
  },
  {
    id: 'direct_binding', version: 1, label: '直接结合', claimTypes: ['direct_binding'], keywords: /直接结合|direct binding|纯化蛋白|SPR|ITC|MST|far-?western|ligand blot|配体印迹/i,
    minimumEvidence: ['纯化蛋白之间的结合（体外）', '无关蛋白或 GST / 标签单独作阴性对照', '能给出结合强度（Kd）或剂量依赖', '膜上共现或复合物关联本身不等于直接结合'],
    requiredControls: ['标签蛋白单独（GST、His 等）', '无关蛋白', '变性或突变的蛋白'],
    alternatives: ['纯化蛋白中的污染物介导结合', '标签之间的结合', '非特异的疏水或电荷吸附', '膜上（ligand blot）结合不代表溶液中的结合'],
    blocks: [
      { id: 'proteins', title: '蛋白纯化与质控', kind: 'manipulation', minTier: 'light', success: '纯度和完整性达到预先写定的标准（SDS-PAGE）' },
      { id: 'binding', title: '体外结合检测', kind: 'phenotype', minTier: 'light', success: '与标签对照相比有剂量依赖的结合', dependsOn: ['proteins'] },
      { id: 'affinity', title: '结合强度测定（SPR / ITC / MST）', kind: 'specificity', minTier: 'standard', success: '得到 Kd，且重复间一致', dependsOn: ['binding'] },
      { id: 'mutant', title: '结合位点突变', kind: 'mechanism', minTier: 'publication', success: '突变体结合显著减弱', dependsOn: ['binding'] },
    ],
  },
  {
    id: 'localization', version: 1, label: '亚细胞定位', claimTypes: ['association', 'mechanism'], keywords: /定位|共定位|localiz|免疫荧光|IF\b|核质分离|fractionation/i,
    minimumEvidence: ['两种独立方法（成像 + 分级分离）', '定位标志物（细胞器 marker）', '抗体特异性验证（敲低后信号消失）', '盲法或自动化的图像定量'],
    requiredControls: ['只加二抗的对照', '细胞器 marker', '分级分离的纯度 marker'],
    alternatives: ['抗体非特异染色', '过表达或标签导致的错误定位', '固定方法造成的假象', '成像串色（bleed-through）'],
    blocks: [
      { id: 'antibody', title: '抗体特异性验证', kind: 'manipulation', minTier: 'standard', success: '敲低后信号明显减弱' },
      { id: 'imaging', title: '免疫荧光共定位', kind: 'phenotype', minTier: 'light', success: '与 marker 的共定位系数达到预先写定的标准' },
      { id: 'fractionation', title: '亚细胞分级分离 + WB', kind: 'specificity', minTier: 'standard', success: '目标富集在预期组分，纯度 marker 正确', dependsOn: ['imaging'] },
    ],
  },
  {
    id: 'pathway', version: 1, label: '通路依赖', claimTypes: ['mechanism'], keywords: /通路|信号|pathway|signal|抑制剂|inhibitor|磷酸化|phospho/i,
    minimumEvidence: ['上游操作改变下游通路的活化（如磷酸化）', '阻断通路后表型被消除（抑制剂 + 遗传学方法）', '抑制剂的剂量与特异性有依据', '时间顺序合理：通路变化先于表型'],
    requiredControls: ['溶剂对照（DMSO 等）', '第二种结构不同的抑制剂或遗传学阻断', '总蛋白（相对于磷酸化蛋白）'],
    alternatives: ['抑制剂的脱靶作用', '通路是表型的结果而不是原因', '平行通路的代偿', '细胞活力下降造成的假象'],
    blocks: [
      { id: 'activation', title: '通路活化读出', kind: 'manipulation', minTier: 'light', success: '下游标志（如 p-X / 总 X）随上游操作改变' },
      { id: 'blockade', title: '阻断通路后的表型', kind: 'phenotype', minTier: 'light', success: '阻断后表型差异消失或明显减弱', dependsOn: ['activation'] },
      { id: 'second-blocker', title: '第二种阻断方式', kind: 'specificity', minTier: 'standard', success: '结构不同的抑制剂或遗传学阻断得到相同结论', dependsOn: ['blockade'] },
      { id: 'timecourse', title: '时间进程', kind: 'mechanism', minTier: 'publication', success: '通路变化早于表型出现', dependsOn: ['activation'] },
    ],
  },
  {
    id: 'association', version: 1, label: '表达关联', claimTypes: ['association'], keywords: /关联|相关|表达水平|association|correlat|预后|临床样本|组织芯片/i,
    minimumEvidence: ['足够且说明来源的样本，事先写定纳入与排除', '在两个层面或两个队列中一致', '控制主要混杂因素（如分期、年龄）', '结论只写“关联”，不写因果'],
    requiredControls: ['配对的正常组织或基线组', '技术重复与批次记录', '阴性染色对照（IHC）'],
    alternatives: ['混杂因素（分期、治疗、取材部位）', '批次效应', '选择偏倚', '反向因果'],
    blocks: [
      { id: 'cohort', title: '样本与纳入标准', kind: 'baseline', minTier: 'light', success: '样本量与来源达到预先写定的要求' },
      { id: 'measure', title: '表达测定', kind: 'phenotype', minTier: 'light', success: '组间差异达到预先写定的标准', dependsOn: ['cohort'] },
      { id: 'validation', title: '独立队列或第二种方法验证', kind: 'specificity', minTier: 'standard', success: '方向一致', dependsOn: ['measure'] },
    ],
  },
];

export const templateById = (id: string) => chainTemplates.find(template => template.id === id);

/**
 * The template to start from: a keyword in what the author wrote wins (a rescue or an IP names its method), then the
 * first template of the claim type. Nothing is chosen for the author; they can switch before the chain is drafted.
 */
export function suggestTemplate(textOfStudy: string, claimType: ClaimType | ''): ChainTemplate {
  const byKeyword = chainTemplates.filter(template => template.keywords.test(textOfStudy));
  return byKeyword.find(template => !claimType || template.claimTypes.includes(claimType))
    ?? chainTemplates.find(template => claimType && template.claimTypes.includes(claimType))
    ?? byKeyword[0] ?? chainTemplates[0];
}

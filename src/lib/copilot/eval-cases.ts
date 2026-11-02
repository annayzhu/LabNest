import { chineseNumbers, parseTidy, tidyMarkdown, tidyPrompt, unsupportedTokens, type EntryTidy } from '../entry-tidy';
import { srgnCards, srgnChain, srgnContext } from './plan-design/fixtures';
import { cardPrompt, chainPrompt, contextPrompt, parseCard, parseChain, parseContext, parseReview, reviewPrompt } from './plan-design/prompts';
import { checkCards } from './plan-design/rules';
import { reviewDimensions, type Chain, type ContextCard, type DesignCard } from './plan-design/spec';
import { templateById } from './plan-design/templates';
import type { SpecId } from './specs';

/**
 * The evaluation cases for the Copilot task specs (Q335, Q336), run by `scripts/eval-copilot.ts`. Each case is one
 * prompt, the reader its step uses, the checks a good answer passes, and a hand-written answer that passes them (fed
 * through the same reader and checks when no service is named). `agree` names what several runs of a case should
 * agree on. The SRGN design is the user's own case; the dictated records are made up and wait for the user to
 * confirm their expected answers.
 */
export type Check = { name: string; pass: boolean };
export type EvalCase = {
  id: string; spec: SpecId; prompt: { system: string; user: string };
  checks: (text: string) => Check[]; expected: string; agree?: (text: string) => string;
};

const has = (pattern: RegExp, text: string) => pattern.test(text);
const block = (id: string) => srgnChain.blocks.find(item => item.id === id)!;
const protocols = [{ id: 'p1', code: 'PRT-001', title: 'Transwell 迁移' }];

function contextChecks(card: ContextCard): Check[] {
  return [
    { name: 'question, claim type and subject filled', pass: Boolean(card.question && card.claimType && card.subject) },
    { name: 'necessity claim (knockdown)', pass: card.claimType === 'necessity' },
    { name: 'subject names SRGN', pass: has(/SRGN/i, card.subject) },
    { name: 'model system names KYSE150', pass: has(/KYSE150/i, card.modelSystem) },
  ];
}
function chainChecks(chain: Chain): Check[] {
  const manipulation = chain.blocks.filter(item => item.kind === 'manipulation').map(item => item.id);
  return [
    { name: 'a manipulation block and a phenotype block', pass: manipulation.length > 0 && chain.blocks.some(item => item.kind === 'phenotype') },
    { name: 'the phenotype waits for the manipulation check', pass: chain.blocks.some(item => item.kind === 'phenotype' && item.dependsOn.some(id => manipulation.includes(id))) },
    { name: 'off-target effects named as an alternative', pass: chain.alternatives.some(item => has(/脱靶|off-target/i, item.text)) },
    { name: 'minimum evidence stated', pass: chain.minimumEvidence.length > 0 },
  ];
}
function cardChecks(card: DesignCard): Check[] {
  return [
    { name: 'no serious rule finding', pass: !checkCards([card], srgnChain, 'standard').some(finding => finding.severity === 'serious') },
    { name: 'a concurrent negative control', pass: card.controls.some(control => ['negative', 'vehicle', 'empty_vector'].includes(control.kind) && control.concurrent) },
    { name: 'two independent siRNAs', pass: (card.manipulation.independentReagents ?? 0) >= 2 },
    { name: 'migration is read out', pass: card.readouts.some(readout => readout.assay === 'migration' || has(/迁移|transwell|migration/i, `${readout.name} ${readout.method}`)) },
    { name: 'at least two groups and a criterion', pass: card.groups.length >= 2 && card.criteria.length > 0 },
  ];
}
function tidyChecks(words: string, expect: { values: number[]; experiment?: string; unclear?: boolean }) {
  return (tidy: EntryTidy): Check[] => {
    const text = `${tidy.title}\n${tidyMarkdown(tidy)}`;
    const numbers = new Set([...(text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number), ...chineseNumbers(text)]);
    return [
      { name: 'nothing added: every number and code is in the words', pass: unsupportedTokens(text, words).length === 0 },
      { name: `keeps the values ${expect.values.join(', ')}`, pass: expect.values.every(value => numbers.has(value)) },
      { name: 'a title of 30 characters at most', pass: tidy.title.length <= 30 },
      { name: expect.experiment ? `names ${expect.experiment}` : 'names no experiment', pass: tidy.experiment.toUpperCase() === (expect.experiment ?? '').toUpperCase() },
      ...(expect.unclear ? [{ name: 'says what is unclear', pass: tidy.unclear.length > 0 }] : []),
    ];
  };
}
const read = <T,>(parse: (text: string) => T, checks: (value: T) => Check[]) => (text: string) => {
  try { return checks(parse(text)); } catch (error) { return [{ name: `readable: ${error instanceof Error ? error.message.slice(0, 120) : 'no'}`, pass: false }]; }
};

const purpose = '研究 SRGN 敲低是否抑制 KYSE150 细胞迁移';
const items = [{ id: 'inventory-1', kind: 'inventory' as const, label: 'KYSE150', detail: '细胞系 · 在库 3 份', included: true }, { id: 'inventory-2', kind: 'inventory' as const, label: 'SRGN 抗体', detail: '抗体 · 在库 1 份', included: true }];
const proliferationFinding = { verdict: 'revise', dimensions: reviewDimensions.map(key => ({ key, verdict: key === 'confounding' ? 'concern' : 'ok', note: '' })),
  findings: [{ severity: 'major', dimension: 'confounding', blockId: 'phenotype', field: 'readouts', problem: '迁移细胞数减少也可能来自增殖变慢，设计里没有增殖对照', suggestion: '同时做 CCK-8 增殖检测' }] };

const dictations = [
  { id: 'entry-transfection', words: '今天上午十点给KYSE150换液然后转染si-SRGN两条，浓度五十纳摩尔，每孔用了两微升lipo3000，那个24孔板，下午看了一下细胞状态还行，明天四十八小时收RNA做qPCR',
    expect: { values: [50, 2, 24, 48] },
    answer: { title: 'KYSE150 转染 si-SRGN', done: ['上午 10 点给 KYSE150 换液后转染两条 si-SRGN（24 孔板）'], seen: ['下午细胞状态还行'], values: ['si-SRGN 50 nM', 'Lipo3000 每孔 2 µL'], next: ['明天转染后 48 h 收 RNA 做 qPCR'], unclear: [], experiment: '' } },
  { id: 'entry-transwell', words: 'EXP-0012 的 Transwell 今天拍照了，si-1 那组明显少，NC 大概每个视野两百个左右，si-1 一百个不到，si-2 还没数',
    expect: { values: [200, 100], experiment: 'EXP-0012' },
    answer: { title: 'EXP-0012 Transwell 拍照', done: ['Transwell 拍照'], seen: ['si-1 组迁移细胞明显少'], values: ['NC 约 200 个/视野', 'si-1 不到 100 个/视野'], next: ['数 si-2'], unclear: [], experiment: 'EXP-0012' } },
  { id: 'entry-unsure', words: '那个离心机好像是一万二还是一万三转，记不清了，十分钟，四度',
    expect: { values: [10, 4], unclear: true },
    answer: { title: '离心条件', done: ['离心 10 分钟，4 度'], seen: [], values: ['转速 12000 或 13000 转（记不清）'], next: [], unclear: ['离心转速是 12000 还是 13000 转'], experiment: '' } },
];

export const evalCases: EvalCase[] = [
  { id: 'srgn-context', spec: 'plan-design.context', prompt: contextPrompt(purpose, items), checks: read(parseContext, contextChecks), expected: JSON.stringify(srgnContext), agree: text => parseContext(text).claimType },
  { id: 'srgn-chain', spec: 'plan-design.chain', prompt: chainPrompt(srgnContext, templateById('knockdown')!), checks: read(parseChain, chainChecks), expected: JSON.stringify(srgnChain),
    agree: text => parseChain(text).blocks.map(item => item.kind).join('→') },
  { id: 'srgn-card-phenotype', spec: 'plan-design.card', prompt: cardPrompt(srgnContext, srgnChain, 'standard', block('phenotype'), protocols),
    checks: read(text => parseCard(text, block('phenotype'), protocols), cardChecks), expected: JSON.stringify(srgnCards[1]),
    agree: text => parseCard(text, block('phenotype'), protocols).groups.map(group => group.name).join(',') },
  { id: 'srgn-review-proliferation', spec: 'plan-design.review', prompt: reviewPrompt(srgnContext, srgnChain, 'standard', srgnCards, checkCards(srgnCards, srgnChain, 'standard'), 1),
    checks: read(parseReview, review => [{ name: 'raises the proliferation confound', pass: review.findings.some(finding => has(/增殖|prolifera/i, `${finding.problem} ${finding.suggestion}`)) }]),
    expected: JSON.stringify(proliferationFinding), agree: text => parseReview(text).verdict },
  ...dictations.map((item): EvalCase => ({ id: item.id, spec: 'entry.tidy', prompt: tidyPrompt({ title: '快速记录', words: item.words }), checks: read(parseTidy, tidyChecks(item.words, item.expect)),
    expected: JSON.stringify(item.answer), agree: text => parseTidy(text).experiment || '-' })),
];

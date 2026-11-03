import { detectableEffect, requiredN, type PowerInput } from '../../stats/power';
import { sampleSizeOf, type DesignCard, type SampleSize } from './spec';

/**
 * A design card's sample size worked out by the program (Q305, K-Dense statistical-power). The effect is Cohen's d =
 * difference / SD; for one-way ANOVA the smallest difference between two group means gives Cohen's f = d / √(2k), the
 * least favourable spread. α is shared across the comparisons (Bonferroni) and n is raised for the replicates expected
 * to be lost. A single n hides its biggest uncertainty, so the effect is also varied (sensitivity), and the planned
 * number of biological replicates is turned around into the smallest effect it can detect.
 */
export type SampleSizePlan = {
  input: SampleSize;
  /** d, or f for ANOVA; undefined when nothing to compute from. */
  effect?: number;
  /** Analysed per group (pairs for a paired design), then with the expected losses. */
  analysed?: number | null; enrolled?: number;
  sensitivity: { scale: number; effect: number; n: number | null }[];
  /** The replicates this card plans, and the smallest effect they detect at the chosen power. */
  planned?: number; detectable?: number | null;
  /** Why no n was computed. */
  missing?: 'basis' | 'effect' | 'groups';
};

export const powerInput = (input: SampleSize, groups: number): PowerInput => ({ design: input.design, alpha: input.alpha / Math.max(1, input.comparisons), groups: Math.max(2, groups) });
const positive = (value: number | null) => value !== null && Number.isFinite(value) && value > 0 ? value : undefined;

/** The effect the inputs give: from the difference and the SD when both are there, otherwise the effect size typed in. */
export function effectOf(input: SampleSize, groups: number) {
  const sd = positive(input.sd), difference = input.difference === null ? undefined : Math.abs(input.difference);
  if (sd && difference) return input.design === 'anova' ? difference / sd / Math.sqrt(2 * Math.max(2, groups)) : difference / sd;
  return positive(input.effect);
}

export function planSampleSize(card: DesignCard): SampleSizePlan {
  const input = sampleSizeOf(card);
  const groups = card.groups.length;
  const power = powerInput(input, groups);
  const planned = card.replicates.biological ?? (input.basis === 'convention' ? input.n ?? undefined : undefined);
  const detectable = planned && planned >= 2 ? detectableEffect(power, planned, input.power) : undefined;
  const base = { input, sensitivity: [], planned: planned ?? undefined, detectable };
  if (input.basis === 'pending') return { ...base, missing: 'basis' };
  if (input.design === 'anova' && groups < 3) return { ...base, missing: 'groups' };
  if (input.basis === 'convention') return base;
  const effect = effectOf(input, groups);
  if (!effect) return { ...base, missing: 'effect' };
  const analysed = requiredN(power, effect, input.power);
  // A pilot's effect is usually inflated (winner's curse), so its range looks at smaller effects.
  const scales = input.basis === 'pilot' ? [0.5, 0.75, 1] : [0.75, 1, 1.25];
  return {
    ...base, effect, analysed,
    enrolled: analysed === null ? undefined : Math.ceil(analysed / (1 - input.attrition) - 1e-9),
    sensitivity: scales.map(scale => ({ scale, effect: effect * scale, n: requiredN(power, effect * scale, input.power) })),
  };
}

/** The card as saved: a computed basis stores the n the program worked out, a pending one stores none. */
export function withComputedN(card: DesignCard): DesignCard {
  const input = sampleSizeOf(card);
  if (input.basis === 'convention') return { ...card, sampleSize: input };
  const plan = planSampleSize({ ...card, sampleSize: input });
  return { ...card, sampleSize: { ...input, n: input.basis === 'pending' ? null : plan.enrolled ?? null } };
}

/** The sample size in one line of the plan, with every input a reader needs to work it out again. */
export function sampleSizeLine(card: DesignCard) {
  const plan = planSampleSize(card), input = plan.input;
  const symbol = input.design === 'anova' ? 'f' : 'd';
  const alpha = input.comparisons > 1 ? `α = ${input.alpha}/${input.comparisons}` : `α = ${input.alpha}`;
  const design = { two_groups: '两组独立 t 检验', paired: '配对 t 检验', anova: `单因素方差分析（${card.groups.length} 组）` }[input.design];
  const detect = plan.planned && plan.detectable ? `按计划的 ${plan.planned} 个生物学重复，${Math.round(input.power * 100)}% 把握度能发现的最小效应 ${symbol} ≈ ${plan.detectable.toFixed(2)}` : '';
  if (input.basis === 'pending') return `样本量：需要预实验（效应量未知，不编数字）${detect ? `；${detect}` : ''}`;
  if (input.basis === 'convention') return `样本量：每组 ${input.n ?? '待定'}（惯例，未按效应量计算）${detect ? `；${detect}` : ''}`;
  if (!plan.effect) return '样本量：依据未填效应量，无法计算';
  const losses = input.attrition ? `，按 ${Math.round(input.attrition * 100)}% 损失增加到 ${plan.enrolled}` : '';
  const range = plan.sensitivity.filter(item => item.scale !== 1).map(item => `${symbol} = ${item.effect.toFixed(2)} 时 ${item.n ?? '超过 10000'}`).join('，');
  const basis = input.basis === 'pilot' ? '依据预实验' : '依据最小关注效应';
  return `样本量：每组 ${plan.analysed ?? '超过 10000'}${losses}（${basis}${input.source ? `：${input.source}` : ''}；${design}，${symbol} = ${plan.effect.toFixed(2)}，${alpha}，双侧，把握度 ${input.power}；敏感性：${range}）${detect ? `；${detect}` : ''}`;
}

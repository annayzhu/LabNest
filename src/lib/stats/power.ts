import { fQuantile, noncentralFSurvival, noncentralTCdf, studentTQuantile } from './distributions';

/**
 * A priori power for the designs a bench experiment usually has (Q305): two independent groups and paired samples by a
 * two-sided t-test, several groups by one-way ANOVA. Effects are Cohen's d (for paired samples, d of the differences)
 * or Cohen's f for ANOVA. The same formulas as statsmodels' TTestIndPower, TTestPower and FTestAnovaPower, which the
 * K-Dense statistical-power skill wraps; n is per group (or pairs), and the model never computes it.
 */
export const powerDesigns = ['two_groups', 'paired', 'anova'] as const;
export type PowerDesign = typeof powerDesigns[number];
export type PowerInput = { design: PowerDesign; alpha: number; groups?: number };

const MAX_N = 10_000;

/** Power at `n` per group (pairs for a paired design) for effect `effect`. */
export function powerAt(input: PowerInput, effect: number, n: number): number {
  if (input.design === 'anova') {
    const k = Math.max(2, input.groups ?? 3), total = k * n;
    if (total - k < 1) return 0;
    return noncentralFSurvival(fQuantile(1 - input.alpha, k - 1, total - k), k - 1, total - k, effect * effect * total);
  }
  const df = input.design === 'paired' ? n - 1 : 2 * n - 2;
  if (df < 1) return 0;
  const delta = input.design === 'paired' ? effect * Math.sqrt(n) : effect * Math.sqrt(n / 2);
  const critical = studentTQuantile(1 - input.alpha / 2, df);
  return 1 - noncentralTCdf(critical, df, delta) + noncentralTCdf(-critical, df, delta);
}

/** The smallest n per group (or pairs) that reaches `power`; null when even 10,000 does not. */
export function requiredN(input: PowerInput, effect: number, power: number): number | null {
  if (!(effect > 0)) return null;
  const reaches = (n: number) => powerAt(input, effect, n) >= power;
  let low = 1, high = 2;
  while (!reaches(high)) { if (high >= MAX_N) return null; low = high; high = Math.min(MAX_N, high * 2); }
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (reaches(mid)) high = mid; else low = mid; }
  return high;
}

/** The smallest effect `n` per group (or pairs) detects with `power`: the sensitivity at a fixed n. */
export function detectableEffect(input: PowerInput, n: number, power: number): number | null {
  if (powerAt(input, 50, n) < power) return null;
  let low = 0, high = 50;
  for (let i = 0; i < 60; i += 1) { const mid = (low + high) / 2; if (powerAt(input, mid, n) >= power) high = mid; else low = mid; }
  return high;
}

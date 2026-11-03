import { describe, expect, it } from 'vitest';
import { fCdf, noncentralFSurvival, noncentralTCdf, normalCdf, studentTCdf, studentTQuantile } from './distributions';
import { detectableEffect, powerAt, requiredN } from './power';

// Reference values from statsmodels 0.14.4 (SciPy 1.14.1): TTestIndPower, TTestPower and FTestAnovaPower, α = 0.05 two-sided.
const two = { design: 'two_groups' as const, alpha: 0.05 };
const paired = { design: 'paired' as const, alpha: 0.05 };

describe('distributions', () => {
  it('match SciPy', () => {
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 10);
    expect(normalCdf(-1)).toBeCloseTo(0.15865525393145707, 10);
    expect(studentTQuantile(0.975, 4)).toBeCloseTo(2.7764451051977987, 8);
    expect(studentTQuantile(0.975, 30)).toBeCloseTo(2.0422724563012373, 8);
    expect(studentTCdf(-2.5, 7)).toBeCloseTo(0.020496109292876437, 8);
    expect(fCdf(3.5, 2, 12)).toBeCloseTo(0.9365303840308571, 8);
    expect(noncentralTCdf(1.5, 6, 2.2)).toBeCloseTo(0.2412227578190965, 8);
    expect(noncentralFSurvival(3, 2, 9, 7.5)).toBeCloseTo(0.6866141079981519, 8);
  });
});

describe('sample size', () => {
  it('matches statsmodels for two independent groups', () => {
    for (const [d, n] of [[0.5, 63.7656], [0.8, 25.5246], [1, 16.7147], [1.5, 8.0603], [2, 5.0900], [3, 3.0700]]) expect(requiredN(two, d, 0.8)).toBe(Math.ceil(n));
    expect(requiredN(two, 2, 0.9)).toBe(7); // 6.387
    expect(powerAt(two, 2, 5)).toBeCloseTo(0.7905423635621195, 6);
    expect(powerAt({ ...two, alpha: 0.025 }, 1.2, 3)).toBeCloseTo(0.11955367199456794, 6);
  });

  it('matches statsmodels for paired samples', () => {
    for (const [d, n] of [[0.5, 33.3671], [1, 9.9379], [2, 4.2207]]) expect(requiredN(paired, d, 0.8)).toBe(Math.ceil(n));
    expect(powerAt(paired, 1, 6)).toBeCloseTo(0.5068419772922792, 6);
  });

  it('matches statsmodels for one-way ANOVA (n per group = total / k)', () => {
    expect(requiredN({ design: 'anova', alpha: 0.05, groups: 4 }, 0.25, 0.8)).toBe(Math.ceil(178.396 / 4));
    expect(requiredN({ design: 'anova', alpha: 0.05, groups: 3 }, 1, 0.8)).toBe(Math.ceil(13.144 / 3));
    // statsmodels' own figures (0.54180, 0.87316) use CDFLIB's ncfdtr, good to about 1e-5; these are SciPy's ncf (Boost).
    expect(powerAt({ design: 'anova', alpha: 0.05, groups: 3 }, 0.8, 4)).toBeCloseTo(0.5417937520737833, 8);
    expect(powerAt({ design: 'anova', alpha: 0.05, groups: 3 }, 1.5, 3)).toBeCloseTo(0.8731574616515574, 8);
  });

  it('gives the smallest detectable effect at a fixed n', () => {
    expect(detectableEffect(two, 3, 0.8)).toBeCloseTo(3.0709, 3);
    expect(detectableEffect(two, 4, 0.8)).toBeCloseTo(2.3808, 3);
    expect(detectableEffect(two, 6, 0.8)).toBeCloseTo(1.7955, 3);
    expect(detectableEffect(paired, 4, 0.8)).toBeCloseTo(2.1280, 3);
  });

  it('refuses what it cannot compute', () => {
    expect(requiredN(two, 0, 0.8)).toBeNull();
    expect(requiredN(two, 0.001, 0.8)).toBeNull();
    expect(powerAt(two, 1, 1)).toBe(0);
  });
});

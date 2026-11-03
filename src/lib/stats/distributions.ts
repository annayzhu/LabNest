/**
 * The distributions LabNest's own statistics need, in plain TypeScript so every number it shows can be worked out again:
 * the incomplete beta and gamma functions, Student's t and F, and the noncentral t and F that power calculations use.
 * Checked against statsmodels 0.14 / SciPy 1.14 in power.test.ts.
 */

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i += 1) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

const EPS = 1e-15, TINY = 1e-300;

/** The regularized incomplete beta function I_x(a, b), by its continued fraction (modified Lentz). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2) ? front * betaFraction(x, a, b) / a : 1 - front * betaFraction(1 - x, b, a) / b;
}

function betaFraction(x: number, a: number, b: number) {
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  d = 1 / (Math.abs(d) < TINY ? TINY : d);
  let result = d;
  for (let m = 1; m <= 500; m += 1) {
    for (const numerator of [m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m)), -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))]) {
      d = 1 + numerator * d; d = 1 / (Math.abs(d) < TINY ? TINY : d);
      c = 1 + numerator / c; if (Math.abs(c) < TINY) c = TINY;
      result *= d * c;
    }
    if (Math.abs(d * c - 1) < EPS) break;
  }
  return result;
}

/** The regularized upper incomplete gamma function Q(a, x). */
function upperGamma(a: number, x: number): number {
  if (x <= 0) return 1;
  const front = Math.exp(a * Math.log(x) - x - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a, sum = term;
    for (let n = 1; n < 1000 && Math.abs(term) > Math.abs(sum) * EPS; n += 1) { term *= x / (a + n); sum += term; }
    return 1 - front * sum;
  }
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; d = 1 / (Math.abs(d) < TINY ? TINY : d);
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    h *= d * c;
    if (Math.abs(d * c - 1) < EPS) break;
  }
  return front * h;
}

/** Φ(z), the standard normal distribution function. */
export function normalCdf(z: number): number {
  const tail = 0.5 * upperGamma(0.5, z * z / 2);
  return z < 0 ? tail : 1 - tail;
}

/** P(T ≤ t) for Student's t with `df` degrees of freedom. */
export function studentTCdf(t: number, df: number): number {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/** P(F ≤ f) for the F distribution with (d1, d2) degrees of freedom. */
export function fCdf(f: number, d1: number, d2: number): number {
  return f <= 0 ? 0 : incompleteBeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2);
}

/** The value a distribution function reaches `p` at, by bisection between `low` and a doubling upper bound. */
function quantile(cdf: (x: number) => number, p: number, low: number) {
  let high = Math.max(1, low + 1);
  while (cdf(high) < p && high < 1e8) high *= 2;
  for (let i = 0; i < 200 && high - low > 1e-12 * Math.max(1, high); i += 1) {
    const mid = (low + high) / 2;
    if (cdf(mid) < p) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

/** t with P(T ≤ t) = p. */
export const studentTQuantile = (p: number, df: number) => p === 0.5 ? 0 : p > 0.5 ? quantile(t => studentTCdf(t, df), p, 0) : -quantile(t => studentTCdf(t, df), 1 - p, 0);
/** f with P(F ≤ f) = p. */
export const fQuantile = (p: number, d1: number, d2: number) => quantile(f => fCdf(f, d1, d2), p, 0);

/** P(T' ≤ t) for the noncentral t with `df` degrees of freedom and noncentrality `delta` (Lenth 1989, AS 243). */
export function noncentralTCdf(t: number, df: number, delta: number): number {
  const negative = t < 0;
  const tt = negative ? -t : t, del = negative ? -delta : delta;
  let sum = 0;
  const x = tt * tt / (tt * tt + df);
  if (x > 0) {
    const lambda = del * del;
    let p = 0.5 * Math.exp(-0.5 * lambda), q = Math.sqrt(2 / Math.PI) * p * del, s = 0.5 - p;
    let a = 0.5;
    const b = 0.5 * df, rxb = Math.pow(1 - x, b), logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    let xOdd = incompleteBeta(x, a, b), gOdd = 2 * rxb * Math.exp(a * Math.log(x) - logBeta);
    let xEven = 1 - rxb, gEven = b * x * rxb;
    sum = p * xOdd + q * xEven;
    for (let en = 1; en <= 2000; en += 1) {
      a += 1;
      xOdd -= gOdd; xEven -= gEven;
      gOdd *= x * (a + b - 1) / a;
      gEven *= x * (a + b - 0.5) / (a + 0.5);
      p *= lambda / (2 * en);
      q *= lambda / (2 * en + 1);
      s -= p;
      sum += p * xOdd + q * xEven;
      if (2 * s * (xOdd - gOdd) <= 1e-12) break;
    }
  }
  sum += normalCdf(-del);
  return Math.min(1, Math.max(0, negative ? 1 - sum : sum));
}

/** P(F' > f) for the noncentral F with (d1, d2) degrees of freedom and noncentrality `lambda`: a Poisson mixture of betas. */
export function noncentralFSurvival(f: number, d1: number, d2: number, lambda: number): number {
  if (f <= 0) return 1;
  const x = d1 * f / (d1 * f + d2), half = lambda / 2;
  const last = Math.ceil(half + 12 * Math.sqrt(half + 1) + 30);
  let survival = 0;
  for (let j = 0; j <= last; j += 1) {
    const weight = Math.exp(-half + (j ? j * Math.log(half) : 0) - logGamma(j + 1));
    if (weight > 0) survival += weight * (1 - incompleteBeta(x, d1 / 2 + j, d2 / 2));
  }
  return Math.min(1, Math.max(0, survival));
}

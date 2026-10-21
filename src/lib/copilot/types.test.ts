import { describe, expect, it } from 'vitest';
import { planTitleFromPurpose } from './types';

describe('The title of a plan the Copilot makes', () => {
  it('is the first sentence of the research purpose', () => {
    expect(planTitleFromPurpose('证明敲低 A 基因能抑制食管鳞癌细胞生长。再找出通路')).toBe('证明敲低 A 基因能抑制食管鳞癌细胞生长');
    expect(planTitleFromPurpose('  Test whether gene A drives growth. Then find the pathway ')).toBe('Test whether gene A drives growth');
  });

  it('is cut at 60 characters with an ellipsis', () => {
    expect(planTitleFromPurpose('a'.repeat(100))).toBe(`${'a'.repeat(60)}…`);
  });
});

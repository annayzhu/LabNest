import { describe, expect, it } from 'vitest';
import { reconcileStructuredStepDraft } from './structured-step-draft';
describe('local actual-value draft reconciliation', () => {
  const recorded = { dose: { value: 50 } };
  const draft = { values: { dose: '55' }, reason: '尚未提交的原因', context: 'same operation and units', recorded: JSON.stringify(recorded) };
  it('keeps a draft across unrelated timer/other-step revisions', () => {
    expect(reconcileStructuredStepDraft(draft, draft.context, recorded)).toEqual({ values: { dose: '55' }, reason: draft.reason, contextChanged: false, needsReview: false });
  });
  it('clears only the actual value acknowledged by the server, keeping unrelated reason', () => {
    expect(reconcileStructuredStepDraft(draft, draft.context, { dose: { value: 55 } })).toEqual({ values: {}, reason: draft.reason, contextChanged: false, needsReview: false });
  });
  it('requires explicit review after another writer changes the same actual value', () => {
    expect(reconcileStructuredStepDraft(draft, draft.context, { dose: { value: 60 } }).needsReview).toBe(true);
  });
  it('does not automatically apply a draft after the operation or its units change', () => {
    expect(reconcileStructuredStepDraft(draft, 'different units', recorded).contextChanged).toBe(true);
  });
});

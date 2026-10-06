import { parseEntryMutationFormData } from "./entry-mutations";
import { describe, expect, it } from 'vitest';
import { shouldFreezeEntrySources, editedEventPrecision, recoveredDraftVersion } from './entry-lifecycle';
describe('Entry history boundaries', () => {
 it('rejects creating a second primary experiment from a Run context', () => {
  const form = new FormData(); Object.entries({title:'测试',contentMarkdown:'测试正文',experimentId:'existing',protocolVersionId:'new-protocol'}).forEach(([k,v])=>form.set(k,v));
  expect(()=>parseEntryMutationFormData(form)).toThrow(/现有实验/);
 });
 it('freezes on first submit, preserves that version during review, captures again after explicit reopen', () => {
  expect(shouldFreezeEntrySources('recorded','submitted')).toBe(true);
  expect(shouldFreezeEntrySources('submitted','reviewed')).toBe(false);
  expect(shouldFreezeEntrySources('reviewed','draft')).toBe(false);
  expect(shouldFreezeEntrySources('draft','reviewed')).toBe(true);
 });
 it('date-only edits cannot invent a clock time', () => {
  expect(editedEventPrecision('date','2026-10-02')).toBe('date');
  expect(editedEventPrecision('unknown','2026-10-02T12:00')).toBe('datetime');
  expect(editedEventPrecision('date','')).toBe('unknown');
 });
 it('any old edit draft without a version must conflict, including metadata-only drafts', () => {
  expect(recoveredDraftVersion(true, undefined, '2026-10-06T00:00:00Z')).toBe('1970-01-01T00:00:00.000Z');
  expect(recoveredDraftVersion(true, '2026-10-05T00:00:00Z','2026-10-06T00:00:00Z')).toBe('2026-10-05T00:00:00Z');
  expect(recoveredDraftVersion(false,undefined,'')).toBe('');
 });
});

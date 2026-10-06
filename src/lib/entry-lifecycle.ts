import { isRecordLocked } from './record-lifecycle';
/** Reviewing an already submitted record must preserve its signed source version. */
export function shouldFreezeEntrySources(previous: string, next: string) {
  return !isRecordLocked(previous) && isRecordLocked(next);
}
export function editedEventPrecision(previous: string, value: string) {
  return value ? previous === 'date' ? 'date' : 'datetime' : 'unknown';
}
/** No timestamp means no evidence that an edit draft was based on the current record. */
export function recoveredDraftVersion(editing: boolean, saved: string | undefined, current: string) {
  return saved || (editing ? '1970-01-01T00:00:00.000Z' : current);
}

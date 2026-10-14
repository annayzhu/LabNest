'use client';
import { useEffect, useState } from 'react';
import { listMobileMutations, mobileQueueChangedEvent, orderMobileMutations, type QueuedStepCompletionMutation, type QueuedStepRecordMutation } from '@/lib/mobile-mutation-queue';
export function useQueuedRunRecords(experimentId: string) {
  const [records, setRecords] = useState<Array<QueuedStepCompletionMutation | QueuedStepRecordMutation>>([]);
  useEffect(() => {
    const read = () => { void listMobileMutations().then(items => setRecords(orderMobileMutations(items).filter((item): item is QueuedStepCompletionMutation | QueuedStepRecordMutation => (item.actionType === 'step.complete' || item.actionType === 'step.record') && item.payload.experimentId === experimentId))).catch(error => window.dispatchEvent(new CustomEvent('labnest:mobile-storage-error', { detail: String(error) }))); };
    read(); window.addEventListener(mobileQueueChangedEvent, read);
    return () => window.removeEventListener(mobileQueueChangedEvent, read);
  }, [experimentId]);
  return records;
}

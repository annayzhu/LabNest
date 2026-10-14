import { newClientMutationId } from './client-mutation-id';
import type { QueuedRunContext } from './queued-run-revision.server';
import type { CalculatorResult } from "./calculators/calculator-engine";
export type MobileMutationState = "local_only" | "pending" | "syncing" | "synced" | "conflict";

export type QueuedEntryMutation = {
  clientMutationId: string;
  actionType: "entry.create";
  deviceCreatedAt: string;
  state: MobileMutationState;
  retryCount: number;
  lastError?: string;
  payload: {
    fields: Record<string, string>;
    newFileIds: string;
    mediaOrder: string;
    files: Array<{ name: string; file: File }>;
  };
};

export type QueuedInventoryMutation = {
  clientMutationId: string;
  actionType: "inventory.transaction";
  deviceCreatedAt: string;
  state: MobileMutationState;
  retryCount: number;
  lastError?: string;
  payload: {
    inventoryItemId: string;
    type: "receive" | "consume" | "discard" | "return";
    quantity: number;
    performedBy?: string;
    experimentId?: string;
    experimentStepId?: string;
    purchaseId?: string;
    notes?: string;
  };
};

export type QueuedMeasurementMutation = {
  clientMutationId: string;
  actionType: "measurement.create";
  deviceCreatedAt: string;
  state: MobileMutationState;
  retryCount: number;
  lastError?: string;
  payload: {
    experimentId: string;
    experimentStepId: string;
    value: number;
    unit: string;
    observedAt: string;
    sampleLabel?: string;
    expectedMin?: number;
    expectedMax?: number;
    notes?: string;
  };
};

export type QueuedStepCompletionMutation = {
  clientMutationId: string;
  actionType: "step.complete";
  deviceCreatedAt: string;
  state: MobileMutationState;
  retryCount: number;
  lastError?: string;
  payload: {
    executionPlanRevision?: number;
    queueContext?: QueuedRunContext;
    experimentId: string;
    experimentStepId: string;
    deviationType?: string;
    deviationNote?: string;
    deviationImpact?: string;
    deviationAuthor?: string;
  };
};

export type QueuedAttachmentMutation = {
  clientMutationId: string;
  actionType: "attachment.upload";
  deviceCreatedAt: string;
  state: MobileMutationState;
  retryCount: number;
  lastError?: string;
  payload: {
    file: File;
    targetType: string;
    targetId: string;
    linkType: string;
    order?: string;
  };
};

export type QueuedCalculationMutation = {
  clientMutationId: string; actionType: "calculation.create"; deviceCreatedAt: string;
  state: MobileMutationState; retryCount: number; lastError?: string;
  payload: { experimentId: string; experimentStepId: string; operator: string; calculatorId: string; inputs: Record<string,unknown>; snapshot: CalculatorResult };
};
export type QueuedRunMaterialMutation = {clientMutationId:string;actionType:"run.material";deviceCreatedAt:string;state:MobileMutationState;retryCount:number;lastError?:string;payload:{experimentId:string;row:Record<string,unknown>}};
export type QueuedStepRecordMutation = {clientMutationId:string;actionType:'step.record';deviceCreatedAt:string;state:MobileMutationState;retryCount:number;lastError?:string;payload:{experimentId:string;experimentStepId:string;executionPlanRevision:number;queueContext?:QueuedRunContext;intent:'actual'|'skip'|'unskip';reason?:string;values:Record<string,{value:number;unit:string}>}};
export type MobileMutation = QueuedStepRecordMutation | QueuedRunMaterialMutation | QueuedCalculationMutation | QueuedEntryMutation | QueuedInventoryMutation | QueuedMeasurementMutation | QueuedStepCompletionMutation | QueuedAttachmentMutation;

const databaseName = "labnest-mobile-mutations";
const storeName = "mutations";
export const mobileQueueChangedEvent = "labnest:mobile-queue-changed";
export const mobileSyncRequestedEvent = "labnest:mobile-sync-requested";

function openQueueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "clientMutationId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Mobile sync queue could not be opened."));
  });
}

async function withQueueStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openQueueDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error("Mobile sync queue transaction aborted."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Mobile sync queue transaction failed."));
      request.onerror = () => reject(request.error ?? new Error("Mobile sync queue operation failed."));
    });
  } finally {
    database.close();
  }
}

function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent(mobileQueueChangedEvent));
}

export async function enqueueMobileMutation(mutation: MobileMutation) {
  // One IndexedDB transaction orders dependent writes even when two tabs capture at once.
  const database = await openQueueDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite'), store = transaction.objectStore(storeName);
      const read = store.getAll();
      read.onsuccess = () => {
        if ((mutation.actionType === 'step.complete' || mutation.actionType === 'step.record') && mutation.payload.queueContext) {
          const prior = (read.result as MobileMutation[]).filter(item => (item.actionType === 'step.complete' || item.actionType === 'step.record') && item.payload.experimentId === mutation.payload.experimentId && item.payload.executionPlanRevision === mutation.payload.executionPlanRevision);
          const predecessorIds = new Set(prior.flatMap(item => ('queueContext' in item.payload && item.payload.queueContext?.predecessorMutationId) ? [item.payload.queueContext.predecessorMutationId] : []));
          const tail = prior.find(item => !predecessorIds.has(item.clientMutationId));
          if (tail) mutation.payload.queueContext.predecessorMutationId = tail.clientMutationId;
        }
        store.put(mutation);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('本机保存失败，请保留页面并重试。'));
    });
  } finally { database.close(); }
  notifyQueueChanged();
}

export function listMobileMutations() {
  return withQueueStore<MobileMutation[]>("readonly", (store) => store.getAll());
}

export async function updateMobileMutation(mutation: MobileMutation) {
  await withQueueStore<IDBValidKey>("readwrite", (store) => store.put(mutation));
  notifyQueueChanged();
}

export async function removeMobileMutation(clientMutationId: string) {
  await withQueueStore<undefined>("readwrite", (store) => store.delete(clientMutationId));
  notifyQueueChanged();
}

export function requestMobileMutationSync() {
  window.dispatchEvent(new CustomEvent(mobileSyncRequestedEvent));
}

export function mobileMutationStatusLabel(state: MobileMutationState) {
  return state === "local_only" ? "Saved on this device"
    : state === "pending" ? "Waiting to sync"
      : state === "syncing" ? "Syncing"
        : state === "synced" ? "Synced"
          : "Sync conflict";
}

export function runQueueContext(sourceRef: string): QueuedRunContext {
  const key = 'labnest.execution-device-id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) { deviceId = newClientMutationId(); localStorage.setItem(key, deviceId); }
  return { deviceId, actor: 'local-workspace-user', sourceRef };
}

/** Stored IDs are UUIDs, not chronological keys. Visit explicit predecessors first. */
export function orderMobileMutations(items: MobileMutation[]) {
  const result: MobileMutation[] = [], visited = new Set<string>(), visiting = new Set<string>();
  const visit = (item: MobileMutation) => {
    if (visited.has(item.clientMutationId)) return;
    if (visiting.has(item.clientMutationId)) throw new Error('本机队列依赖异常，请核对记录。');
    visiting.add(item.clientMutationId);
    const predecessor = 'queueContext' in item.payload ? item.payload.queueContext?.predecessorMutationId : undefined;
    const prior = items.find(candidate => candidate.clientMutationId === predecessor);
    if (prior) visit(prior);
    visiting.delete(item.clientMutationId); visited.add(item.clientMutationId); result.push(item);
  };
  items.forEach(visit);
  return result;
}

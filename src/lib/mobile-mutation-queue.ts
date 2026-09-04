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

export type MobileMutation = QueuedEntryMutation | QueuedInventoryMutation | QueuedMeasurementMutation;

const databaseName = "labnest-mobile-mutations";
const storeName = "mutations";
export const mobileQueueChangedEvent = "labnest:mobile-queue-changed";

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
      request.onsuccess = () => resolve(request.result);
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
  await withQueueStore<IDBValidKey>("readwrite", (store) => store.put(mutation));
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

export function mobileMutationStatusLabel(state: MobileMutationState) {
  return state === "local_only" ? "Saved on this device"
    : state === "pending" ? "Waiting to sync"
      : state === "syncing" ? "Syncing"
        : state === "synced" ? "Synced"
          : "Sync conflict";
}

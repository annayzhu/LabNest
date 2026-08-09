export type StoredEntryDraft<TFields> = {
  fields: TFields;
  newFiles: Array<{ id: string; file: File }>;
  mediaOrder: Array<{ kind: "existing" | "new"; id: string }>;
  savedAt: string;
};

const databaseName = "labnest-entry-drafts";
const storeName = "drafts";

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Draft storage could not be opened."));
  });
}

async function withDraftStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDraftDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Draft storage operation failed."));
    });
  } finally {
    database.close();
  }
}

export function loadEntryDraft<TFields>(key: string) {
  return withDraftStore<StoredEntryDraft<TFields> | undefined>("readonly", (store) => store.get(key));
}

export function saveEntryDraft<TFields>(key: string, draft: StoredEntryDraft<TFields>) {
  return withDraftStore<IDBValidKey>("readwrite", (store) => store.put(draft, key));
}

export function deleteEntryDraft(key: string) {
  return withDraftStore<undefined>("readwrite", (store) => store.delete(key));
}

import {
  customFontDatabaseName,
  customFontStoreName,
  type CustomFontRecord,
} from "./typography-settings";

const loadedFaces = new Map<string, FontFace>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(customFontDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(customFontStoreName)) {
        request.result.createObjectStore(customFontStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地字体库。"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(customFontStoreName, mode);
      const request = run(transaction.objectStore(customFontStoreName));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("本地字体操作失败。"));
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error("本地字体操作已中止。"));
      transaction.onerror = () => reject(transaction.error ?? new Error("本地字体操作失败。"));
    });
  } finally {
    database.close();
  }
}

export function listCustomFonts(): Promise<CustomFontRecord[]> {
  return withStore("readonly", (store) => store.getAll()).then((records) => records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function saveCustomFont(record: CustomFontRecord): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(record));
}

export async function deleteCustomFont(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  const face = loadedFaces.get(id);
  if (face) {
    document.fonts.delete(face);
    loadedFaces.delete(id);
  }
}

export async function loadCustomFont(record: CustomFontRecord): Promise<void> {
  if (loadedFaces.has(record.id)) return;
  const face = new FontFace(record.family, record.data);
  const loaded = await face.load();
  document.fonts.add(loaded);
  loadedFaces.set(record.id, loaded);
}

export async function createCustomFontRecord(file: File): Promise<CustomFontRecord> {
  const id = crypto.randomUUID().replaceAll("-", "");
  const name = file.name.replace(/\.(woff2|ttf|otf)$/i, "").trim().slice(0, 80) || "自定义字体";
  return {
    id,
    family: `LabNest Custom ${id}`,
    name,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    data: await file.arrayBuffer(),
    createdAt: new Date().toISOString(),
  };
}

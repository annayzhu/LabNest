import {
  applyTypographySettings,
  customFontDatabaseName,
  customFontStoreName,
  parseTypographySettings,
  reconcileTypographySettings,
  typographySettingsStorageKey,
  type CustomFontRecord,
  type TypographySettings,
} from "./typography-settings";

const loadedFaces = new Map<string, FontFace[]>();
const latinUnicodeRange = "U+0000-024F, U+1E00-1EFF, U+2000-206F";
const cjkUnicodeRange = "U+2E80-2EFF, U+3000-303F, U+31C0-31EF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF";

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
  const faces = loadedFaces.get(id);
  if (faces) {
    faces.forEach((face) => document.fonts.delete(face));
    loadedFaces.delete(id);
  }
}

export async function loadCustomFont(record: CustomFontRecord): Promise<void> {
  if (loadedFaces.has(record.id)) return;
  const faces = [
    new FontFace(`${record.family} Latin`, record.data.slice(0), { unicodeRange: latinUnicodeRange }),
    new FontFace(`${record.family} CJK`, record.data.slice(0), { unicodeRange: cjkUnicodeRange }),
  ];
  const loaded = await Promise.all(faces.map((face) => face.load()));
  loaded.forEach((face) => document.fonts.add(face));
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

export async function hydrateTypographyPreferences({ loadAllFonts = false } = {}): Promise<{ settings: TypographySettings; fonts: CustomFontRecord[] }> {
  const storedSettings = parseTypographySettings(window.localStorage.getItem(typographySettingsStorageKey));
  applyTypographySettings(storedSettings);
  const fonts = await listCustomFonts();
  const settings = reconcileTypographySettings(storedSettings, new Set(fonts.map((font) => font.id)));
  if (settings !== storedSettings) applyTypographySettings(settings);
  const selectedIds = new Set(Object.values(settings).flatMap((selection) => selection.kind === "custom" ? [selection.id] : []));
  const fontsToLoad = loadAllFonts ? fonts : fonts.filter((font) => selectedIds.has(font.id));
  await Promise.allSettled(fontsToLoad.map(loadCustomFont));
  return { settings, fonts };
}

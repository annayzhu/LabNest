import {
  applyTypographySettings,
  customFontDatabaseName,
  customFontStoreName,
  maxCustomFontBytes,
  parseTypographySettings,
  reconcileTypographySettings,
  typographySettingsStorageKey,
  type CustomFontRecord,
  type CustomFontFaceRecord,
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

function saveCustomFont(record: CustomFontRecord): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(record));
}

function unloadCustomFont(id: string): void {
  const faces = loadedFaces.get(id);
  if (!faces) return;
  faces.forEach((face) => document.fonts.delete(face));
  loadedFaces.delete(id);
}

export async function deleteCustomFont(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  unloadCustomFont(id);
}

export async function loadCustomFont(record: CustomFontRecord): Promise<void> {
  if (loadedFaces.has(record.id)) return;
  const storedFaces: CustomFontFaceRecord[] = record.faces?.length ? record.faces : record.data ? [{
    id: `${record.id}-regular`,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    data: record.data,
    weight: "400",
    style: "normal",
  }] : [];
  const faces = storedFaces.flatMap((storedFace) => [
    new FontFace(`labnest-custom-${record.id}`, storedFace.data.slice(0), { unicodeRange: latinUnicodeRange, weight: storedFace.weight, style: storedFace.style }),
    new FontFace(`labnest-custom-${record.id}`, storedFace.data.slice(0), { unicodeRange: cjkUnicodeRange, weight: storedFace.weight, style: storedFace.style }),
  ]);
  if (!faces.length) throw new Error("字体族中没有可加载的字形文件。");
  const loaded = await Promise.all(faces.map((face) => face.load()));
  loaded.forEach((face) => document.fonts.add(face));
  loadedFaces.set(record.id, loaded);
}

const faceTokens = /(extralight|ultralight|extrabold|ultrabold|semibold|demibold|regular|normal|medium|italic|oblique|black|heavy|light|bold|thin)/gi;

export function inferCustomFontFace(fileName: string): { familyName: string; weight: string; style: "normal" | "italic" } {
  const stem = fileName.replace(/\.(woff2|ttf|otf)$/i, "");
  const tokens = Array.from(stem.matchAll(faceTokens), (match) => match[0].toLowerCase());
  const style = tokens.some((token) => token === "italic" || token === "oblique") ? "italic" : "normal";
  const variableWeight = /(?:variablefont|\bvf\b|\[wght\]|[_-]wght)/i.test(stem);
  const weight = variableWeight ? "100 900" : tokens.some((token) => ["black", "heavy"].includes(token)) ? "900"
    : tokens.some((token) => ["extrabold", "ultrabold"].includes(token)) ? "800"
      : tokens.some((token) => ["bold"].includes(token)) ? "700"
        : tokens.some((token) => ["semibold", "demibold"].includes(token)) ? "600"
          : tokens.some((token) => token === "medium") ? "500"
            : tokens.some((token) => token === "light") ? "300"
              : tokens.some((token) => ["extralight", "ultralight"].includes(token)) ? "200"
                : tokens.some((token) => token === "thin") ? "100" : "400";
  const rawFamily = stem.replace(/variablefont|\[wght\]|[_-]wght|\bvf\b/gi, " ").replace(faceTokens, " ").replace(/[-_]+/g, " ").trim();
  const familyName = rawFamily
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Custom font";
  return { familyName, weight, style };
}

export function validateCustomFontFamily(files: ReadonlyArray<Pick<File, "name" | "size">>, locale: "zh" | "en" = "zh"): string | null {
  const message = (zh: string, en: string) => locale === "zh" ? zh : en;
  if (!files.length) return message("请选择至少一个字体文件。", "Choose at least one font file.");
  const fileError = files.map((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["woff2", "ttf", "otf"].includes(extension)) return message("请选择 WOFF2、TTF 或 OTF 字体文件。", "Choose WOFF2, TTF, or OTF font files.");
    if (file.size <= 0) return message("字体文件为空。", "A font file is empty.");
    if (file.size > maxCustomFontBytes) return message("单个字体文件不能超过 10 MB。", "A font file cannot exceed 10 MB.");
    return null;
  }).find(Boolean);
  if (fileError) return fileError;
  const faces = files.map((file) => inferCustomFontFace(file.name));
  const normalizedFamilies = new Set(faces.map((face) => face.familyName.toLocaleLowerCase().replace(/\s+/g, "")));
  if (normalizedFamilies.size > 1) return message("所选文件看起来不属于同一个字体族，请分开导入或修正文件名。", "The selected files do not appear to belong to one font family. Import them separately or correct their filenames.");
  const faceKeys = faces.map((face) => `${face.weight}:${face.style}`);
  if (new Set(faceKeys).size !== faceKeys.length) return message("检测到重复的字重/字形，请移除重复文件后再导入。", "Duplicate weight/style faces were detected. Remove duplicates and retry.");
  return null;
}

async function createCustomFontRecord(files: readonly File[], familyNameOverride?: string): Promise<CustomFontRecord> {
  if (!files.length) throw new Error("No font files selected.");
  const id = crypto.randomUUID().replaceAll("-", "");
  const inferred = inferCustomFontFace(files[0].name);
  const faces = await Promise.all(files.map(async (file, index): Promise<CustomFontFaceRecord> => {
    const face = inferCustomFontFace(file.name);
    return {
      id: `${id}-${index + 1}`,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data: await file.arrayBuffer(),
      weight: face.weight,
      style: face.style,
    };
  }));
  return {
    id,
    family: `LabNest Custom ${id}`,
    name: (familyNameOverride?.trim() || inferred.familyName).slice(0, 80),
    fileName: files.length === 1 ? files[0].name : `${inferred.familyName} (${files.length} faces)`,
    mimeType: "font/family",
    size: faces.reduce((total, face) => total + face.size, 0),
    faces,
    createdAt: new Date().toISOString(),
  };
}

export type CustomFontImportStage = "read" | "parse" | "persist";

export class CustomFontImportError extends Error {
  constructor(public readonly stage: CustomFontImportStage) {
    super(`Custom font import failed during ${stage}.`);
    this.name = "CustomFontImportError";
  }
}

export async function importCustomFont(file: File): Promise<CustomFontRecord> {
  return importCustomFontFamily([file]);
}

export async function importCustomFontFamily(files: readonly File[], options: { familyName?: string } = {}): Promise<CustomFontRecord> {
  let record: CustomFontRecord;
  try {
    record = await createCustomFontRecord(files, options.familyName);
  } catch {
    throw new CustomFontImportError("read");
  }

  try {
    await loadCustomFont(record);
  } catch {
    throw new CustomFontImportError("parse");
  }

  try {
    await saveCustomFont(record);
  } catch {
    unloadCustomFont(record.id);
    throw new CustomFontImportError("persist");
  }
  return record;
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

export async function hydrateReferencedCustomFonts(root: ParentNode = document): Promise<void> {
  const ids = new Set(Array.from(root.querySelectorAll<HTMLElement>('[data-labnest-font-family^="labnest-custom-"]'))
    .map((element) => element.dataset.labnestFontFamily?.replace(/^labnest-custom-/, ""))
    .filter((id): id is string => Boolean(id)));
  if (!ids.size) return;
  const fonts = await listCustomFonts();
  await Promise.allSettled(fonts.filter((font) => ids.has(font.id)).map(loadCustomFont));
}

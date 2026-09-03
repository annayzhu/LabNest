export const localFontCatalogStorageKey = "labnest.local-font-catalog.v1";

export type LocalFontFamilyRecord = {
  id: string;
  name: string;
  styles: string[];
  fullNames: string[];
  postscriptNames: string[];
};

type BrowserLocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
};

const maxLocalFontFamilies = 500;
const safeLocalFontId = /^[a-z0-9-]{1,80}$/;

function stableFamilyId(name: string) {
  let hash = 2166136261;
  for (const character of name.normalize("NFKC").toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `f${(hash >>> 0).toString(36)}`;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function parseLocalFontFamilies(serialized: string | null): LocalFontFamilyRecord[] {
  if (!serialized) return [];
  try {
    const value = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    return value.slice(0, maxLocalFontFamilies).flatMap((candidate): LocalFontFamilyRecord[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const record = candidate as Partial<LocalFontFamilyRecord>;
      if (typeof record.id !== "string" || !safeLocalFontId.test(record.id) || typeof record.name !== "string" || !record.name.trim()) return [];
      return [{
        id: record.id,
        name: record.name.trim().slice(0, 120),
        styles: unique(Array.isArray(record.styles) ? record.styles.filter((item): item is string => typeof item === "string") : []),
        fullNames: unique(Array.isArray(record.fullNames) ? record.fullNames.filter((item): item is string => typeof item === "string") : []),
        postscriptNames: unique(Array.isArray(record.postscriptNames) ? record.postscriptNames.filter((item): item is string => typeof item === "string") : []),
      }];
    });
  } catch {
    return [];
  }
}

export function groupLocalFontFaces(faces: BrowserLocalFontData[]): LocalFontFamilyRecord[] {
  const grouped = new Map<string, BrowserLocalFontData[]>();
  for (const face of faces) {
    const family = face.family?.trim();
    if (!family) continue;
    grouped.set(family, [...(grouped.get(family) ?? []), face]);
  }
  return [...grouped.entries()].map(([name, familyFaces]) => ({
    id: stableFamilyId(name),
    name,
    styles: unique(familyFaces.map((face) => face.style)),
    fullNames: unique(familyFaces.map((face) => face.fullName)),
    postscriptNames: unique(familyFaces.map((face) => face.postscriptName)),
  })).sort((left, right) => left.name.localeCompare(right.name)).slice(0, maxLocalFontFamilies);
}

export function localFontCssVariable(id: string) {
  return `--ln-local-font-${safeLocalFontId.test(id) ? id : "invalid"}`;
}

function quoteCssFamily(name: string) {
  return `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function applyLocalFontFamilies(families: LocalFontFamilyRecord[], root: HTMLElement = document.documentElement) {
  for (const family of families) root.style.setProperty(localFontCssVariable(family.id), quoteCssFamily(family.name));
}

export function loadStoredLocalFontFamilies(storage: Storage = window.localStorage) {
  const families = parseLocalFontFamilies(storage.getItem(localFontCatalogStorageKey));
  applyLocalFontFamilies(families);
  return families;
}

type LocalFontAccessWindow = Window & typeof globalThis & {
  queryLocalFonts?: () => Promise<BrowserLocalFontData[]>;
};

export function canDiscoverLocalFonts(windowValue: LocalFontAccessWindow = window) {
  return typeof windowValue.queryLocalFonts === "function";
}

export async function discoverLocalFontFamilies(windowValue: LocalFontAccessWindow = window, storage: Storage = window.localStorage) {
  const queryLocalFonts = windowValue.queryLocalFonts;
  if (!queryLocalFonts) throw new Error("local-font-access-unavailable");
  const families = groupLocalFontFaces(await queryLocalFonts.call(windowValue));
  storage.setItem(localFontCatalogStorageKey, JSON.stringify(families));
  applyLocalFontFamilies(families);
  window.dispatchEvent(new CustomEvent("labnest:local-fonts-changed"));
  return families;
}

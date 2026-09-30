import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomFontImportError, hydrateTypographyPreferences, importCustomFont, inferCustomFontFace, validateCustomFontFamily } from "./custom-font-storage";
import { defaultTypographySettings, typographyCssStorageKey, typographyCssVariables, typographySettingsStorageKey } from "./typography-settings";

function emptyFontLibrary() {
  const database = {
    close: () => undefined,
    transaction: () => {
      const transaction: { oncomplete?: () => void; objectStore: () => unknown } = {
        objectStore: () => ({
          getAll: () => {
            const request: { result: unknown[]; onsuccess?: () => void } = { result: [] };
            queueMicrotask(() => {
              request.onsuccess?.();
              transaction.oncomplete?.();
            });
            return request;
          },
        }),
      };
      return transaction;
    },
  };
  return {
    open: () => {
      const request: { result: typeof database; onsuccess?: () => void } = { result: database };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}

function stubTypographyPage(stored: Record<string, string>) {
  const values = new Map(Object.entries(stored));
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal("window", { localStorage, indexedDB: emptyFontLibrary() });
  vi.stubGlobal("document", { documentElement: { style: { setProperty: () => undefined, removeProperty: () => undefined } } });
  return values;
}

describe("custom font import", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rolls back loaded faces when browser persistence fails", async () => {
    const add = vi.fn();
    const remove = vi.fn();
    class TestFontFace {
      load() { return Promise.resolve(this); }
    }

    const database = {
      close: vi.fn(),
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            const request: { error?: Error; onerror?: () => void } = {};
            queueMicrotask(() => {
              request.error = new Error("quota exceeded");
              request.onerror?.();
            });
            return request;
          },
        }),
      }),
    };
    const indexedDB = {
      open: () => {
        const request: { result: typeof database; onsuccess?: () => void } = { result: database };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    };

    vi.stubGlobal("FontFace", TestFontFace);
    vi.stubGlobal("document", { fonts: { add, delete: remove } });
    vi.stubGlobal("window", { indexedDB });
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-1234-1234-1234-123456789abc" });

    const file = {
      name: "lab-font.ttf",
      type: "application/x-font-sfnt",
      size: 4,
      arrayBuffer: async () => new Uint8Array([0, 1, 0, 0]).buffer,
    } as File;

    const failure = await importCustomFont(file).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CustomFontImportError);
    expect(failure).toMatchObject({ stage: "persist" });
    expect(add).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(database.close).toHaveBeenCalledOnce();
  });

  it("loads default typography without storing it as the user's choice", async () => {
    const stored = stubTypographyPage({});
    const { settings } = await hydrateTypographyPreferences();
    expect(settings).toEqual(defaultTypographySettings);
    expect(stored.size).toBe(0);
  });

  it("keeps the stored choice untouched while refreshing the pre-paint cache for a missing imported font", async () => {
    const serialized = JSON.stringify({
      ...defaultTypographySettings,
      latinDocumentBody: { kind: "custom", id: "gone", family: "LabNest Custom gone", name: "Gone" },
    });
    const stored = stubTypographyPage({ [typographySettingsStorageKey]: serialized });
    const { settings } = await hydrateTypographyPreferences();
    expect(settings).toEqual(defaultTypographySettings);
    expect(stored.get(typographySettingsStorageKey)).toBe(serialized);
    expect(JSON.parse(stored.get(typographyCssStorageKey) ?? "{}")).toEqual(typographyCssVariables(defaultTypographySettings));
  });

  it("groups common font face filenames into one family with weight and style", () => {
    expect(inferCustomFontFace("NotoSansSC-BoldItalic.woff2")).toEqual({
      familyName: "Noto Sans SC",
      style: "italic",
      weight: "700",
    });
    expect(inferCustomFontFace("NotoSansSC-Regular.ttf")).toEqual({
      familyName: "Noto Sans SC",
      style: "normal",
      weight: "400",
    });
  });

  it("rejects mixed families and duplicate faces before loading or persistence", () => {
    expect(validateCustomFontFamily([
      { name: "NotoSansSC-Regular.ttf", size: 4 },
      { name: "OtherSans-Bold.ttf", size: 4 },
    ])).toContain("同一个字体族");
    expect(validateCustomFontFamily([
      { name: "NotoSansSC-Bold.ttf", size: 4 },
      { name: "NotoSansSC-Bold.woff2", size: 4 },
    ])).toContain("重复");
  });

  it("represents variable font weight ranges", () => {
    expect(inferCustomFontFace("NotoSansSC-VariableFont_wght.ttf")).toMatchObject({ weight: "100 900" });
  });
});

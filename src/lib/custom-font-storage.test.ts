import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomFontImportError, importCustomFont, inferCustomFontFace, validateCustomFontFamily } from "./custom-font-storage";

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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverLocalFontFamilies,
  groupLocalFontFaces,
  noLocalFontFamilies,
  parseLocalFontFamilies,
  storedLocalFontFamiliesSnapshot,
  subscribeToLocalFontFamilies,
} from "./local-font-catalog";

describe("local font catalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves a stable stored snapshot that discovery updates through its change event", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } as Storage;
    vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: storage }));
    vi.stubGlobal("document", { documentElement: { style: { setProperty: () => undefined } } });
    expect(storedLocalFontFamiliesSnapshot()).toBe(noLocalFontFamilies);

    const onChange = vi.fn();
    const unsubscribe = subscribeToLocalFontFamilies(onChange);
    await discoverLocalFontFamilies({
      queryLocalFonts: async () => [{ family: "Device Sans", fullName: "Device Sans Regular", postscriptName: "DeviceSans-Regular", style: "Regular" }],
    } as unknown as Parameters<typeof discoverLocalFontFamilies>[0], storage);
    expect(onChange).toHaveBeenCalledOnce();
    const discovered = storedLocalFontFamiliesSnapshot();
    expect(discovered).toEqual([expect.objectContaining({ name: "Device Sans", styles: ["Regular"] })]);
    expect(storedLocalFontFamiliesSnapshot()).toBe(discovered);

    unsubscribe();
    window.dispatchEvent(new Event("labnest:local-fonts-changed"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("groups browser-discovered faces into one family", () => {
    expect(groupLocalFontFaces([
      { family: "Example Sans", fullName: "Example Sans Regular", postscriptName: "ExampleSans-Regular", style: "Regular" },
      { family: "Example Sans", fullName: "Example Sans Bold", postscriptName: "ExampleSans-Bold", style: "Bold" },
      { family: "Example Serif", fullName: "Example Serif Italic", postscriptName: "ExampleSerif-Italic", style: "Italic" },
    ])).toEqual([
      expect.objectContaining({ name: "Example Sans", styles: ["Bold", "Regular"] }),
      expect.objectContaining({ name: "Example Serif", styles: ["Italic"] }),
    ]);
  });

  it("rejects malformed persisted records without losing valid families", () => {
    expect(parseLocalFontFamilies(JSON.stringify([
      { id: "f123", name: "Example Sans", styles: ["Regular"], fullNames: [], postscriptNames: [] },
      { id: "../bad", name: "Unsafe" },
    ]))).toEqual([expect.objectContaining({ id: "f123", name: "Example Sans" })]);
  });
});

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { EntryComposer } from "./EntryComposer";
import { I18nProvider } from "./I18nProvider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => "/entries/new", useSearchParams: () => new URLSearchParams() }));
afterEach(() => vi.unstubAllGlobals());
it("does not include a required title in the Capture form", () => {
  vi.stubGlobal("React", React);
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(EntryComposer, {
    mode: "capture", projects: [], researchPlans: [], protocols: [], defaultOccurredAt: "2026-09-06T10:00", defaultSource: "manual",
  })));
  const titles = html.match(/<input\b[^>]*aria-label="Entry title"[^>]*>/g) ?? [];
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.every((input) => !/\brequired=/.test(input))).toBe(true);
});

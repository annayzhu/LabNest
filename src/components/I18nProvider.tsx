"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localeStorageKey, translateUiText, type AppLocale } from "@/lib/i18n";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (text: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const translatedText = new WeakMap<Node, string>();
const translatedAttributes = new WeakMap<Element, Map<string, string>>();
const translatableAttributes = ["placeholder", "aria-label", "title"] as const;

function shouldIgnore(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  return Boolean(element?.closest("script, style, [data-i18n-ignore], [contenteditable='true']"));
}

function localizeTextNode(node: Node, locale: AppLocale) {
  if (node.nodeType !== Node.TEXT_NODE || shouldIgnore(node)) return;
  const current = node.nodeValue ?? "";
  const original = translatedText.get(node);
  if (locale === "en") {
    if (original !== undefined && current !== original) node.nodeValue = original;
    translatedText.delete(node);
    return;
  }
  if (original !== undefined && current === translateUiText(original, "zh")) return;
  const source = original !== undefined && current === original ? original : current;
  translatedText.set(node, source);
  const next = translateUiText(source, "zh");
  if (next !== current) node.nodeValue = next;
}

function localizeElement(element: Element, locale: AppLocale) {
  if (shouldIgnore(element)) return;
  let originals = translatedAttributes.get(element);
  for (const attribute of translatableAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const original = originals?.get(attribute);
    if (locale === "en") {
      if (original !== undefined && current !== original) element.setAttribute(attribute, original);
      originals?.delete(attribute);
      continue;
    }
    if (original !== undefined && current === translateUiText(original, "zh")) continue;
    const source = original !== undefined && current === original ? original : current;
    if (!originals) { originals = new Map(); translatedAttributes.set(element, originals); }
    originals.set(attribute, source);
    const next = translateUiText(source, "zh");
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function localizeTree(root: Node, locale: AppLocale) {
  if (root.nodeType === Node.TEXT_NODE) { localizeTextNode(root, locale); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root as Element, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) localizeTextNode(current, locale);
    else localizeElement(current as Element, locale);
    current = walker.nextNode();
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<AppLocale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem(localeStorageKey);
    if (stored === "zh" || stored === "en") queueMicrotask(() => updateLocale(stored));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.locale = locale;
    window.localStorage.setItem(localeStorageKey, locale);
    document.cookie = `labnest_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    localizeTree(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") localizeTextNode(mutation.target, locale);
        else {
          mutation.addedNodes.forEach((node) => localizeTree(node, locale));
          if (mutation.target.nodeType === Node.ELEMENT_NODE) localizeElement(mutation.target as Element, locale);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...translatableAttributes] });
    return () => observer.disconnect();
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => updateLocale(next), []);
  const toggleLocale = useCallback(() => updateLocale((current) => current === "en" ? "zh" : "en"), []);
  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, toggleLocale, t: (text) => translateUiText(text, locale) }), [locale, setLocale, toggleLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider.");
  return context;
}

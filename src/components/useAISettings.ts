"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AISettingsView } from "@/lib/ai-settings";

const changeEvent = "labnest-ai-settings-changed";
const changeKey = "labnest.ai-settings-change";
export function notifyAISettingsChanged() {
  window.dispatchEvent(new Event(changeEvent));
  try { localStorage.setItem(changeKey, String(Date.now())); } catch { /* Focus refresh remains available. */ }
}
export async function fetchAISettings(): Promise<AISettingsView> {
  const response = await fetch("/api/ai/settings", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取 AI 设置，请重试；已保存的设置未改变。");
  return response.json();
}

/** DB-backed state only. Browser storage carries a notification, never a second configuration. */
export function useAISettings() {
  const [saved, setSaved] = useState<AISettingsView>();
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const accept = useCallback((next: AISettingsView) => {
    sequence.current++;
    setSaved(next); setError(undefined);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try { const next = await fetchAISettings(); if (request === sequence.current) { setSaved(next); setError(undefined); } }
    catch (caught) { if (request === sequence.current) setError(caught instanceof Error ? caught.message : "无法读取 AI 设置。"); }
  }, []);
  useEffect(() => {
    const initialRead = setTimeout(() => { void refresh(); }, 0);
    const requestSequence = sequence;
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const changed = (event: StorageEvent) => { if (event.key === changeKey) void refresh(); };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("storage", changed);
    window.addEventListener(changeEvent, refresh);
    return () => {
      clearTimeout(initialRead);
      requestSequence.current++;
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("storage", changed);
      window.removeEventListener(changeEvent, refresh);
    };
  }, [refresh]);
  return { saved, error, refresh, accept, enabled: !error && Boolean(saved?.enabled), connected: !error && Boolean(saved?.availability.connected) };
}

/** Stale tabs and late replies cannot apply results after the persisted opt-in changes. */
export async function requestAI(input: string, init: RequestInit, needsConnection = true) {
  const before = await fetchAISettings();
  if (!before.enabled) throw new Error("已关闭 AI，现有记录保持不变。");
  if (needsConnection && !before.availability.connected) throw new Error("已开启 · 待配置，请先在 AI 页面完成连接设置。");
  const response = await fetch(input, init);
  await response.clone().arrayBuffer();
  const after = await fetchAISettings();
  if (!after.enabled || after.revision !== before.revision) throw new Error("AI 设置已改变，本次返回结果未应用。请确认设置后重试。");
  return response;
}

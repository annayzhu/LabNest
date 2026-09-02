"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, WifiOff } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export function OfflineCompanion() {
  const { locale } = useI18n();
  const [offline, setOffline] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [score, setScore] = useState(0);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!offline) return;
    const timer = window.setInterval(() => setScore((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [offline]);

  useEffect(() => () => {
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
  }, []);

  function jump() {
    if (jumping) return;
    setJumping(true);
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setJumping(false), 640);
  }

  if (!offline) return null;
  const zh = locale === "zh";
  return (
    <aside className="ln-offline-companion fixed bottom-20 right-3 z-[65] w-[248px] overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft lg:bottom-4 lg:right-4" aria-label={zh ? "离线小游戏" : "Offline mini game"}>
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><WifiOff className="h-3.5 w-3.5 text-action" aria-hidden />{zh ? "离线模式" : "Offline mode"}</span>
        <span className="record-identifier text-[10px] text-muted" aria-live="polite">{zh ? "得分" : "Score"} {score}</span>
      </div>
      <button type="button" className="focus-ring group relative block h-20 w-full overflow-hidden bg-warm/55 text-left" onClick={jump} aria-label={zh ? "让小恐龙跳跃" : "Make the dinosaur jump"}>
        <span className="absolute inset-x-0 bottom-4 h-px bg-hairline" aria-hidden />
        <svg data-jumping={jumping ? "true" : "false"} className="ln-offline-dino absolute bottom-[17px] left-7 h-7 w-8 text-action" viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M7 20V9c0-4 3-7 7-7h9v5h-5v3h7v4H14v4h5v8M9 26v-4M3 17h4" />
          <circle cx="20" cy="5" r=".8" fill="currentColor" stroke="none" />
        </svg>
        <span className="ln-offline-obstacle absolute bottom-[17px] left-0 h-5 w-2 rounded-t-full border border-action-border bg-[var(--contrast-action-soft)]" aria-hidden />
        <span className="absolute bottom-1.5 left-3 text-[10px] text-muted">{zh ? "点击跳跃 · 网络恢复后自动隐藏" : "Tap to jump · hides when online"}</span>
      </button>
      <button type="button" onClick={() => window.location.reload()} className="focus-ring flex w-full items-center justify-center gap-1 border-t border-hairline px-3 py-1.5 text-[10px] font-semibold text-action hover:bg-warm"><RotateCcw className="h-3 w-3" aria-hidden />{zh ? "重新连接" : "Reconnect"}</button>
    </aside>
  );
}

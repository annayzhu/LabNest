"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, DatabaseBackup, FlaskConical, Library, Palette, Sparkles, Type } from "lucide-react";
import { useI18n } from "./I18nProvider";

const sections = [
  { id: "appearance", zh: "外观", en: "Appearance", icon: Palette },
  { id: "typography", zh: "字体排版", en: "Typography", icon: Type },
  { id: "local-backup", zh: "备份", en: "Backup", icon: DatabaseBackup },
  { id: "connectors", zh: "文献连接", en: "Literature connectors", icon: Library },
  { id: "sample-bank", zh: "外部样本库", en: "External sample bank", icon: FlaskConical },
] as const;

const linkedSection = () => sections.find(({ id }) => `#${id}` === window.location.hash)?.id;

/** Settings sections, pinned under the top bar; the section being read is marked as the page scrolls. AI settings live on their own page. */
export function SettingsNav() {
  const router = useRouter();
  const zh = useI18n().locale === "zh";
  const navRef = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState<string>(sections[0].id);
  const jumpedAt = useRef(0);

  // Old links to the AI part of Settings now open the AI page.
  useEffect(() => {
    const follow = () => { if (["#ai-access", "#providers"].includes(window.location.hash)) router.replace(`/ai${window.location.hash}`); };
    follow(); window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router]);

  // Sticks below the top bar, whatever height it has at this width; a linked section then lands below both bars.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".app-shell-content > header");
    const nav = navRef.current;
    const page = nav?.closest<HTMLElement>(".settings-page");
    if (!header || !nav || !page) return;
    let measured = false;
    const observer = new ResizeObserver(() => {
      page.style.setProperty("--settings-sticky-top", `${header.offsetHeight}px`);
      page.style.setProperty("--settings-nav-height", `${nav.offsetHeight}px`);
      if (measured) return;
      measured = true;
      // The browser jumped to the hash before these offsets existed.
      const linked = linkedSection();
      if (linked) document.getElementById(linked)?.scrollIntoView();
    });
    observer.observe(header);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // Right after a jump, keep the chosen section: a short one near the end never reaches the line.
      if (performance.now() - jumpedAt.current < 700) return;
      const line = Math.min(window.innerHeight * 0.3, 240);
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let next: string = sections[0].id;
      for (const { id } of sections) {
        const target = document.getElementById(id);
        if (target && target.getBoundingClientRect().top <= line) next = id;
      }
      setCurrent(atEnd ? sections[sections.length - 1].id : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const linked = linkedSection();
    if (linked) jumpedAt.current = performance.now();
    frame = requestAnimationFrame(() => { frame = 0; if (linked) setCurrent(linked); else update(); });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, []);

  // On narrow screens the list scrolls sideways; keep the current section in view.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>(`[data-section="${current}"]`);
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2, behavior: "smooth" });
  }, [current]);

  return (
    <nav ref={navRef} aria-label={zh ? "设置分类" : "Settings sections"} className="settings-nav">
      {sections.map(({ id, zh: zhLabel, en, icon: Icon }) => (
        <a key={id} href={`#${id}`} data-section={id} aria-current={current === id ? "location" : undefined} className="settings-nav-link focus-ring"
          onClick={() => { jumpedAt.current = performance.now(); setCurrent(id); }}>
          <Icon aria-hidden />{zh ? zhLabel : en}
        </a>
      ))}
      <Link href="/ai" className="settings-nav-link settings-nav-external focus-ring"><Sparkles aria-hidden />{zh ? "AI 设置" : "AI settings"}<ArrowUpRight aria-hidden className="settings-nav-arrow" /></Link>
    </nav>
  );
}

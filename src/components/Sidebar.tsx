"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Beaker,
  BookOpen,
  Boxes,
  ClipboardList,
  FileBarChart,
  Database,
  FolderKanban,
  History,
  Home,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  TabletSmartphone,
  Bot,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { TraditionalMotif } from "@/components/TraditionalMotif";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cn } from "@/lib/cn";
import { useI18n } from "@/components/I18nProvider";
import { holdKeyboard } from "@/lib/keep-keyboard";
import { inNativeApp, postNative } from "@/lib/native-bridge";
import "./mobile-shell.css";

const sidebarStorageKey = "labnest.sidebar.collapsed";

const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/entries", label: "Entries", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/research-plans", label: "Research Plans", icon: Lightbulb },
  { href: "/protocols", label: "Protocols", icon: ClipboardList },
  { href: "/experiments", label: "Experiments", icon: Beaker },
  { href: "/results", label: "Results", icon: Database },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/inventory", label: "Inventory", icon: Boxes, separated: true },
  { href: "/tools", label: "Tools", icon: Wrench },
];

const utilityItems = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/ai", label: "AI settings", icon: Bot },
  { href: "/trash", label: "Recycle Bin", icon: Trash2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The top bar's title on a phone: the module the page belongs to. */
export function sectionLabel(pathname: string) {
  if (pathname === "/") return "LabNest";
  if (pathname.startsWith("/protocol-run") || /^\/experiments\/[^/]+\/run(\/|$)/.test(pathname)) return "Run mode";
  if (pathname.startsWith("/records")) return "Records";
  if (pathname.startsWith("/actions")) return "Manual AI";
  const item = [...navItems, ...utilityItems].find((candidate) => candidate.href !== "/" && (pathname === candidate.href || pathname.startsWith(`${candidate.href}/`)));
  return item?.label ?? "LabNest";
}

function desktopNavItemClass(active: boolean, collapsed: boolean) {
  return cn(
    "sidebar-nav-item focus-ring flex items-center rounded-[var(--ln-radius-control-lg)] py-2 text-[length:var(--ln-ui-nav-font-size)] font-normal tracking-[-0.005em] transition",
    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
    active ? "sidebar-nav-item-active font-semibold" : "text-muted hover:bg-stone/75 hover:text-ink",
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(sidebarStorageKey) === "true") {
      queueMicrotask(() => setCollapsed(true));
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(sidebarStorageKey, String(next));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sidebar-shell sticky top-0 z-50 hidden h-screen shrink-0 border-r border-hairline/80 bg-surface lg:block",
        collapsed ? "w-[72px] px-2" : "w-56 px-3",
      )}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="primary-sidebar-navigation"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="sidebar-toggle focus-ring absolute -right-3 top-5 z-[60] flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-surface text-muted shadow-[0_2px_8px_rgba(56,62,86,0.08)] hover:border-sage hover:text-ink active:scale-[0.96]"
      >
        <span className="sidebar-toggle-icon-stage" aria-hidden>
          <PanelLeftClose className="sidebar-toggle-icon sidebar-toggle-icon-close" />
          <PanelLeftOpen className="sidebar-toggle-icon sidebar-toggle-icon-open" />
        </span>
      </button>

      <div className="h-full overflow-y-auto py-4 [scrollbar-gutter:stable]">
        <Link
          prefetch={pathname === "/ai" ? false : undefined}
          href="/"
          aria-label="LabNest home"
          title={collapsed ? "LabNest" : undefined}
          className={cn(
            "focus-ring mb-5 flex items-center rounded-[var(--ln-radius-control-lg)] py-1.5",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          )}
        >
          <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-[var(--ln-radius-control-lg)] border">
            <TraditionalMotif motif="huiwen" className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className={cn("text-[length:var(--ln-ui-brand-font-size)] font-semibold tracking-[-0.02em] text-ink", collapsed && "sr-only")}>LabNest</span>
        </Link>
        <nav id="primary-sidebar-navigation" aria-label="Primary navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Fragment key={item.href}>
                {item.separated ? <div className="my-3 border-t border-hairline" aria-hidden /> : null}
                <Link
                  prefetch={pathname === "/ai" ? false : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={desktopNavItemClass(active, collapsed)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </Fragment>
            );
          })}
        </nav>
        <nav aria-label="Utilities" className="mt-5 space-y-1 border-t border-hairline pt-3">
          {utilityItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                prefetch={pathname === "/ai" ? false : undefined}
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={desktopNavItemClass(active, collapsed)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/** ＋ writes a quick note on the experiment in progress; the page resolves "active". */
const quickNoteHref = "/entries/new?mode=capture&experiment=active";

function mobileNavItemClass(current: boolean) {
  return cn(
    "focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] px-0.5 text-center text-xs font-normal leading-none tracking-[-0.005em]",
    current ? "bg-action-surface/45 font-semibold text-moss" : "text-muted",
  );
}

/** A phone's bar, Notion-style: Home · Search · Run mode · ＋. Every other module is in the drawer behind ☰. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const runPage = /^\/experiments\/[^/]+\/run(\/|$)/.test(pathname);
  const items = [
    { href: "/", label: "Home", icon: Home, current: pathname === "/" },
    { href: "/search", label: "Search", icon: Search, current: pathname === "/search" },
    { href: "/protocol-run", label: "Run mode", icon: TabletSmartphone, current: pathname === "/protocol-run" || runPage },
  ];
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-hairline bg-surface/95 px-1 pt-1 shadow-soft backdrop-blur-md pb-[calc(0.35rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            prefetch={pathname === "/ai" ? false : undefined}
            key={item.href}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={mobileNavItemClass(item.current)}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="max-w-full whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="New quick capture"
        // The keyboard can only open inside the tap; the note's editor takes it over once the page has changed.
        onClick={() => { holdKeyboard(); router.push(quickNoteHref); }}
        className={mobileNavItemClass(false)}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">New</span>
      </button>
    </nav>
  );
}

/**
 * The drawer behind ☰: the computer's sidebar plus the record timeline. Home and Search are already in the bar. As in #109,
 * on a phone the timeline is "Record history" and Entries is "All entries", so neither reads as the quick capture (＋).
 */
const drawerItems = (zh: boolean) => [
  { href: "/records", label: zh ? "记录历史" : "Record history", icon: History },
  ...navItems.filter((item) => item.href !== "/").map((item) => item.href === "/entries" ? { ...item, label: zh ? "全部记录" : "All entries" } : item),
];
const drawerUtilities = utilityItems.filter((item) => item.href !== "/search");

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const zh = useI18n().locale === "zh";
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const row = (item: { href: string; label: string; icon: typeof Home }) => {
    const Icon = item.icon;
    const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        prefetch={pathname === "/ai" ? false : undefined}
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={current ? "page" : undefined}
        className={cn(
          "focus-ring flex min-h-11 items-center gap-3 rounded-[var(--ln-radius-control-lg)] px-3 text-[0.95rem]",
          current ? "bg-action-surface/55 font-semibold text-moss" : "text-graphite",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };
  // On the page, not inside the top bar: its backdrop blur would become the drawer's frame.
  return createPortal(
    <div className="ln-modal-layer fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close navigation" onClick={onClose} className="ln-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <section
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="ln-mobile-drawer absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-hairline bg-surface px-3 shadow-soft pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <Link href="/" onClick={onClose} className="focus-ring flex items-center gap-2.5 rounded-[var(--ln-radius-control-lg)] py-1.5">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-lg)] border">
              <TraditionalMotif motif="huiwen" className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-[-0.02em] text-ink">LabNest</span>
          </Link>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close navigation" className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {/* In the iPhone app, like Notion's workspace switcher: which LabNest this is, and another one. */}
        {inNativeApp() ? <div className="mb-3 flex items-center justify-between gap-2 rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2">
          <span className="min-w-0 truncate text-sm text-muted" data-i18n-ignore>{window.location.host}</span>
          <button type="button" onClick={() => { onClose(); postNative({ type: "changeServer" }); }} className="focus-ring min-h-11 shrink-0 px-1 text-sm font-semibold text-moss">Change server</button>
        </div> : null}
        <nav aria-label="Primary navigation" className="space-y-0.5">{drawerItems(zh).map(row)}</nav>
        <nav aria-label="Utilities" className="mt-3 space-y-0.5 border-t border-hairline pt-3">{drawerUtilities.map(row)}</nav>
        <div className="mt-auto flex items-center justify-between gap-3 px-3 pt-4">
          <span className="text-sm text-muted">Language</span>
          <LanguageToggle spacious />
        </div>
      </section>
    </div>,
    document.body,
  );
}

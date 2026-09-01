"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  BookOpen,
  Boxes,
  ClipboardList,
  FileBarChart,
  Database,
  Dna,
  FolderKanban,
  Home,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { TraditionalMotif } from "@/components/TraditionalMotif";
import { cn } from "@/lib/cn";

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
  { href: "/sequences", label: "Sequences", icon: Dna },
  { href: "/tools", label: "Tools", icon: Wrench },
];

const utilityItems = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/actions", label: "AI review", icon: Sparkles },
  { href: "/trash", label: "Recycle Bin", icon: Trash2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
        "sticky top-0 z-50 hidden h-screen shrink-0 border-r border-hairline/80 bg-surface transition-[width,padding] duration-200 ease-out lg:block",
        collapsed ? "w-[72px] px-2" : "w-56 px-3",
      )}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="primary-sidebar-navigation"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="focus-ring absolute -right-3 top-5 z-[60] flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-surface text-muted shadow-[0_2px_8px_rgba(56,62,86,0.08)] transition hover:border-sage hover:text-ink active:scale-[0.96]"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      <div className="h-full overflow-y-auto py-4 [scrollbar-gutter:stable]">
        <Link
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

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const items = [navItems[0], navItems[1], navItems[5], navItems[8]];
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = !items.some((item) => active(item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  function closeMoreMenu(restoreFocus = false) {
    setMoreOpen(false);
    if (restoreFocus) queueMicrotask(() => moreButtonRef.current?.focus());
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline bg-surface/95 px-1 pt-1 shadow-soft backdrop-blur-md pb-[calc(0.35rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isCurrent = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] px-0.5 text-center text-[10px] font-normal leading-none tracking-[-0.005em]",
                isCurrent ? "bg-action-surface/45 font-semibold text-moss" : "text-muted",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-full whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="Open more navigation"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-navigation"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] px-0.5 text-center text-[10px] font-normal leading-none tracking-[-0.005em]",
            moreOpen || moreActive ? "bg-action-surface/45 font-semibold text-moss" : "text-muted",
          )}
        >
          <Menu className="h-4 w-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => closeMoreMenu(true)} className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
          <section
            id="mobile-more-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-navigation-title"
            className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface px-4 pt-4 shadow-soft pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="mobile-more-navigation-title" className="font-serif text-xl font-medium text-ink">All modules</h2>
                <p className="mt-1 text-xs text-muted">Open any LabNest workspace or utility.</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => closeMoreMenu(true)} aria-label="Close menu" className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-warm text-muted">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <nav aria-label="All modules" className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = active(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => closeMoreMenu()}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "focus-ring flex min-h-12 items-center gap-3 rounded-[var(--ln-radius-panel-inner)] border px-3 py-2.5 text-sm",
                      isCurrent ? "border-action-border bg-action-surface/55 font-semibold text-moss" : "border-hairline bg-warm text-graphite",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Utilities</h3>
            <nav aria-label="Utilities" className="grid grid-cols-2 gap-2">
              {utilityItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = active(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => closeMoreMenu()}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "focus-ring flex min-h-12 items-center gap-3 rounded-[var(--ln-radius-panel-inner)] border px-3 py-2.5 text-sm",
                      isCurrent ? "border-action-border bg-action-surface/55 font-semibold text-moss" : "border-hairline bg-warm text-graphite",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}

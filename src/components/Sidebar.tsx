"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  BookOpen,
  Boxes,
  ClipboardList,
  Database,
  Download,
  FlaskConical,
  FolderKanban,
  Home,
  Link2,
  Paperclip,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/entries", label: "Entries", icon: BookOpen },
  { href: "/experiments", label: "Experiments", icon: Beaker },
  { href: "/protocols", label: "Protocols", icon: ClipboardList },
  { href: "/samples", label: "Samples", icon: TestTube2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/entities", label: "Entities", icon: TestTube2 },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/results", label: "Results", icon: Database },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sequences", label: "Sequences", icon: FlaskConical },
  { href: "/search", label: "Search", icon: Search },
  { href: "/attachments", label: "Attachments", icon: Paperclip },
  { href: "/exports", label: "Exports", icon: Download },
  { href: "/actions", label: "AI / Tasks", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-hairline bg-warm/90 px-3 py-4 lg:block">
      <Link href="/" className="focus-ring mb-6 flex items-center gap-3 rounded-[10px] px-3 py-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-hairline bg-sage-surface text-moss">
          <Link2 className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block font-serif text-xl font-medium text-ink">LabNest</span>
          <span className="block text-xs text-muted">Protocols, notes, samples, results</span>
        </span>
      </Link>
      <nav aria-label="Primary navigation" className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border border-hairline bg-sage-surface text-moss"
                  : "text-graphite hover:bg-stone/80 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const items = navItems.slice(0, 5);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline bg-surface/95 px-2 pb-2 pt-1 shadow-soft lg:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "focus-ring flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-medium",
              active ? "text-moss" : "text-muted",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

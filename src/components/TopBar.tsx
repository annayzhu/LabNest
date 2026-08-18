"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Command, Home, Search } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

export function TopBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = pathname === "/search" ? searchParams.get("q") ?? "" : "";

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/88 px-3 py-2 backdrop-blur md:px-5 md:py-2">
      <div className="mx-auto flex max-w-[1480px] items-center gap-2 md:gap-3">
        {pathname !== "/" ? (
          <Link href="/" aria-label="Back to Overview" className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface text-moss shadow-paper lg:hidden">
            <Home className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
        <form action="/search" className="min-w-0 flex-1">
          <label className="focus-within:ring-info/20 flex h-9 max-w-xl items-center gap-2 rounded-[8px] border border-hairline bg-surface px-2.5 text-xs text-muted shadow-paper focus-within:border-fog focus-within:ring-4 md:text-sm">
            <Search className="h-4 w-4" aria-hidden />
            <span className="sr-only">Search LabNest</span>
            <input
              key={query}
              name="q"
              defaultValue={query}
              className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
              placeholder="Search LabNest..."
              autoComplete="off"
            />
            <span className="hidden items-center gap-1 rounded-[6px] border border-hairline bg-warm px-1.5 py-0.5 font-mono text-[11px] text-muted sm:flex">
              <Command className="h-3 w-3" aria-hidden /> K
            </span>
          </label>
        </form>
        <LanguageToggle />
      </div>
    </header>
  );
}

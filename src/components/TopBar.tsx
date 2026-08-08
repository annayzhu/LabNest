"use client";

import { Command, Search } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/88 px-4 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-[1480px] items-center gap-3">
        <form action="/search" className="min-w-0 flex-1">
          <label className="focus-within:ring-info/20 flex h-10 max-w-xl items-center gap-2 rounded-[10px] border border-hairline bg-surface px-3 text-sm text-muted shadow-paper focus-within:border-fog focus-within:ring-4">
            <Search className="h-4 w-4" aria-hidden />
            <span className="sr-only">Search LabNest</span>
            <input
              name="q"
              className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
              placeholder="Search entries, protocols, inventory, results..."
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

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Command, Search } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const mobileTitle = pathname === "/"
    ? "LabNest"
    : pathname.startsWith("/protocol-run") || pathname.includes("/run")
      ? "Runs"
      : pathname.startsWith("/entries") || pathname.startsWith("/results")
        ? "Records"
        : pathname.startsWith("/inventory")
          ? "Inventory"
          : "LabNest";

  return (
    <header className="sticky top-0 z-30 border-b border-hairline/80 bg-paper/92 px-3 py-2 backdrop-blur-xl md:px-5">
      <div className="mx-auto flex min-h-11 max-w-[1480px] items-center gap-2 md:gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-between lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {pathname !== "/" ? (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Back"
                className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] text-moss"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
            <span className="truncate font-serif text-lg font-medium text-ink">{mobileTitle}</span>
          </div>
          <Link
            href="/search"
            aria-label="Search LabNest"
            className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] text-moss"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
        </div>
        <form action="/search" className="hidden min-w-0 flex-1 lg:block">
          <label className="ln-global-search flex h-9 max-w-xl items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2.5 text-[length:var(--ln-ui-search-font-size)] text-muted transition focus-within:border-fog focus-within:ring-[3px] focus-within:ring-info/10">
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
            <span className="hidden items-center gap-1 rounded-[var(--ln-radius-control-sm)] border border-hairline bg-warm px-1.5 py-0.5 font-mono text-[11px] text-muted sm:flex">
              <Command className="h-3 w-3" aria-hidden /> K
            </span>
          </label>
        </form>
        <div className="hidden lg:block"><LanguageToggle /></div>
      </div>
    </header>
  );
}

import type { ReactNode } from "react";
import { MobileBottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-clip text-ink">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <TopBar />
          <main className="mx-auto max-w-[1480px] overflow-x-clip px-4 py-4 md:px-5 md:py-5">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

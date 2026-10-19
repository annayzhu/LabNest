import { ContextPropertiesProvider } from "./ContextProperties";
import { readAISettings } from "@/lib/ai-settings";
import { pendingSuggestionEntries } from "@/lib/entry-suggestions";
import { AiStatusProvider } from "./AiAssistant";
import type { ReactNode } from "react";
import { MobileBottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { OfflineCompanion } from "./OfflineCompanion";
import { ModalDialogProvider } from "./ui/ModalDialogProvider";
import { MobileMutationSync } from "./MobileMutationSync";

export async function AppShell({ children }: { children: ReactNode }) {
  // One read per page seeds every AI button and the AI 助手 panel; if the settings read fails, the client reads again.
  const [ai, pending] = await Promise.all([readAISettings().catch(() => undefined), pendingSuggestionEntries().catch(() => [])]);
  return (
    <ModalDialogProvider><ContextPropertiesProvider><AiStatusProvider initial={ai} pending={pending}><div className="app-shell min-h-[100dvh] overflow-x-clip text-ink">
      <div className="app-shell-layout flex">
        <Sidebar />
        <div className="app-shell-content min-w-0 flex-1 pb-28 lg:pb-0">
          <TopBar />
          <main className="app-shell-main mx-auto max-w-[1480px] overflow-x-clip px-4 py-4 md:px-5 md:py-5">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <MobileMutationSync />
      <OfflineCompanion />
    </div></AiStatusProvider></ContextPropertiesProvider></ModalDialogProvider>
  );
}

import { AppShell } from "@/components/AppShell";

export default function EntryDetailLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] animate-pulse space-y-6" aria-label="Loading entry">
        <div className="h-4 w-48 rounded bg-stone" />
        <div className="h-12 w-2/3 rounded bg-stone" />
        <div className="h-72 rounded-[18px] border border-hairline bg-surface" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-80 rounded-[18px] border border-hairline bg-surface" />
          <div className="h-64 rounded-[14px] border border-hairline bg-surface" />
        </div>
      </div>
    </AppShell>
  );
}

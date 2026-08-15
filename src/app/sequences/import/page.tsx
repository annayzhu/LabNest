import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceImportForm } from "@/components/SequenceImportForm";

export default function SequenceImportPage() {
  return <AppShell><div className="space-y-4"><PageHeader title="Import Sequences" /><SequenceImportForm /></div></AppShell>;
}

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceImportForm } from "@/components/SequenceImportForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SequenceImportPage() {
  const projects = await prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <AppShell><div className="space-y-4"><PageHeader title="Import Sequences" /><SequenceImportForm projects={projects} /></div></AppShell>;
}

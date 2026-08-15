import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceForm } from "@/components/SequenceForm";
import { prisma } from "@/lib/db";
import { createSequence } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSequencePage() {
  const projects = await prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <AppShell><div className="space-y-4"><PageHeader title="New Sequence" /><SequenceForm action={createSequence} projects={projects} /></div></AppShell>;
}

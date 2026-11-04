import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { matchKey } from "@/lib/samples";
import { labToolManifest } from "@/lib/tool-manifest";
import { EmbeddedLabTool } from "@/components/EmbeddedLabTool";
import { Activity, Binary, Dna, Grid3X3 } from "lucide-react";
const embeddedIcons = { "qpcr-plate-layout": Grid3X3, "cnv-plate-layout": Dna, "qpcr-analysis": Activity, "cnv-analysis": Binary };
const embeddedIds = new Set(Object.keys(embeddedIcons));

/** An experiment's input samples for the plate planner (S14): by group, then in the experiment's order; a name two of them share is sent as the code. */
async function experimentSampleNames(experimentId: string) {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    select: { id: true, runCode: true, sampleGroups: { select: { id: true, sortOrder: true } }, samples: { where: { role: "input" }, orderBy: { sortOrder: "asc" }, select: { groupId: true, sample: { select: { code: true, name: true } } } } },
  });
  if (!experiment?.samples.length) return experiment ? { id: experiment.id, label: experiment.runCode, names: [] } : undefined;
  const groupOrder = new Map(experiment.sampleGroups.map((group) => [group.id, group.sortOrder]));
  const ordered = [...experiment.samples].sort((a, b) => (a.groupId ? groupOrder.get(a.groupId) ?? 0 : Infinity) - (b.groupId ? groupOrder.get(b.groupId) ?? 0 : Infinity));
  const repeated = new Set(ordered.map((link) => matchKey(link.sample.name)).filter((key, index, keys) => keys.indexOf(key) !== index));
  return { id: experiment.id, label: experiment.runCode, names: ordered.map((link) => (repeated.has(matchKey(link.sample.name)) ? link.sample.code : link.sample.name)) };
}

export default async function Page({ params, searchParams }: { params: Promise<{ toolId: string }>; searchParams?: PageSearchParams }) {
  const { toolId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const tool = labToolManifest.find(item => item.id === toolId);
  if (!tool || !embeddedIds.has(toolId)) notFound();
  const experimentId = firstSearchParam(query, "experiment");
  const samples = experimentId && toolId.endsWith("plate-layout") ? await experimentSampleNames(experimentId) : undefined;
  const Icon = embeddedIcons[toolId as keyof typeof embeddedIcons];
  return <main className={`embedded-tool-workspace flex ${toolId === "qpcr-plate-layout" ? "h-dvh" : "min-h-dvh"} flex-col bg-surface`}><header className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-1"><h1 className="flex min-w-0 items-center gap-2 text-base font-semibold"><Icon className="h-5 w-5 shrink-0 text-moss" strokeWidth={1.7} aria-hidden /><span className="[overflow-wrap:anywhere]">{tool.name}</span></h1>{samples ? <Link className="focus-ring inline-flex min-h-11 items-center text-sm text-moss" href={`/experiments/${samples.id}#section-setup`}>Back to the experiment</Link> : <Link className="focus-ring inline-flex min-h-11 items-center text-sm text-moss" href="/tools">Back to tools</Link>}</header><EmbeddedLabTool id={toolId} title={tool.name} fullPage samples={samples} /></main>;
}

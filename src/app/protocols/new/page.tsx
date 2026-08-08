import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";

const formSchema = z.object({
  canonicalTitle: z.string().trim().min(1).max(180),
  shortTitle: z.string().trim().optional(),
  englishTitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  protocolScope: z.enum(["general", "project"]),
  projectId: z.string().trim().optional(),
  researchPlanId: z.string().trim().optional(),
  availability: z.enum(["draft", "active", "retired", "archived"]),
  reviewStage: z.enum(["draft", "ready_for_review", "reviewed"]),
  displayVersion: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/, "Use a version such as 0.1 or 1.0"),
  purpose: z.string().trim().optional(),
  background: z.string().trim().optional(),
  methodScope: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(48)),
  materials: z.array(z.object({ name: z.string().min(1), notes: z.string().optional() })),
  steps: z.array(z.object({ order: z.number().int().positive(), title: z.string().min(1), description: z.string() })),
}).superRefine((value, context) => {
  if (value.protocolScope === "project" && !value.projectId) {
    context.addIssue({ code: "custom", path: ["projectId"], message: "Project protocols require a project." });
  }
});

function splitTags(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function parseNamedLines(value: FormDataEntryValue | null) {
  return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean).map((line) => {
    const [name, ...notes] = line.split("|").map((item) => item.trim());
    return { name, notes: notes.join(" | ") || undefined };
  });
}

function parseSteps(value: FormDataEntryValue | null) {
  return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean).map((line, index) => {
    const [title, ...description] = line.split("|").map((item) => item.trim());
    return { order: index + 1, title, description: description.join(" | ") };
  });
}

async function nextProtocolCode() {
  const protocols = await prisma.protocol.findMany({ where: { humanCode: { startsWith: "PRT-" } }, select: { humanCode: true } });
  const highest = protocols.reduce((max, item) => {
    const parsed = Number(item.humanCode?.replace("PRT-", ""));
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 100000);
  return `PRT-${String(highest + 1).padStart(6, "0")}`;
}

async function createProtocol(formData: FormData) {
  "use server";

  const parsed = formSchema.parse({
    canonicalTitle: formData.get("canonicalTitle"),
    shortTitle: String(formData.get("shortTitle") ?? "").trim() || undefined,
    englishTitle: String(formData.get("englishTitle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    protocolScope: formData.get("protocolScope") || "general",
    projectId: String(formData.get("projectId") ?? "").trim() || undefined,
    researchPlanId: String(formData.get("researchPlanId") ?? "").trim() || undefined,
    availability: formData.get("availability") || "draft",
    reviewStage: formData.get("reviewStage") || "draft",
    displayVersion: formData.get("displayVersion") || "0.1",
    purpose: String(formData.get("purpose") ?? "").trim() || undefined,
    background: String(formData.get("background") ?? "").trim() || undefined,
    methodScope: String(formData.get("methodScope") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    tags: splitTags(formData.get("tags")),
    materials: parseNamedLines(formData.get("materials")),
    steps: parseSteps(formData.get("steps")),
  });

  const protocol = await prisma.protocol.create({
    data: {
      humanCode: await nextProtocolCode(),
      title: parsed.canonicalTitle,
      canonicalTitle: parsed.canonicalTitle,
      shortTitle: parsed.shortTitle,
      englishTitle: parsed.englishTitle,
      description: parsed.description,
      scope: parsed.protocolScope,
      availability: parsed.availability,
      recordStatus: parsed.reviewStage === "reviewed" ? "reviewed" : parsed.reviewStage === "ready_for_review" ? "submitted" : "draft",
      projectId: parsed.protocolScope === "project" ? parsed.projectId : null,
      tags: parsed.tags,
      versions: {
        create: {
          revision: 1,
          displayVersion: parsed.displayVersion,
          reviewStage: parsed.reviewStage,
          recordStatus: parsed.reviewStage === "reviewed" ? "reviewed" : parsed.reviewStage === "ready_for_review" ? "submitted" : "draft",
          title: `${parsed.canonicalTitle} v${parsed.displayVersion}`,
          purpose: parsed.purpose,
          background: parsed.background,
          scope: parsed.methodScope,
          notes: parsed.notes,
          materialsJson: parsed.materials,
          stepsJson: parsed.steps,
          changeSummary: "Initial version.",
        },
      },
      ...(parsed.researchPlanId ? { researchPlans: { create: { researchPlanId: parsed.researchPlanId, isPrimary: true } } } : {}),
    },
  });

  revalidatePath("/protocols");
  redirect(`/protocols?protocol=${protocol.id}`);
}

export default async function NewProtocolPage() {
  const [projects, researchPlans] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    prisma.researchPlan.findMany({ include: { project: true }, orderBy: { title: "asc" } }),
  ]);
  const inputClass = "focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink";
  const textareaClass = "focus-ring mt-2 min-h-28 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink";

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader eyebrow="Controlled method" title="New Protocol" description="Create the canonical record and its first immutable version. Project adaptation lineage will be added as a dedicated editor workflow." />
        <form action={createProtocol} className="space-y-5">
          <Card>
            <CardHeader title="Identity and governance" eyebrow="Protocol record" />
            <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Canonical title</span><input required name="canonicalTitle" className={inputClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Short title</span><input name="shortTitle" className={inputClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">English title</span><input name="englishTitle" className={inputClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol scope</span><select name="protocolScope" defaultValue="general" className={inputClass}><option value="general">General library</option><option value="project">Project-adapted</option></select></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Project</span><select name="projectId" className={inputClass}><option value="">None</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Research plan</span><select name="researchPlanId" className={inputClass}><option value="">None</option>{researchPlans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.title}</option>)}</select></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Availability</span><select name="availability" defaultValue="draft" className={inputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option><option value="archived">Archived</option></select></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Review stage</span><select name="reviewStage" defaultValue="draft" className={inputClass}><option value="draft">Draft</option><option value="ready_for_review">Ready for review</option><option value="reviewed">Reviewed</option></select></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Version</span><input required name="displayVersion" defaultValue="0.1" className={inputClass} /></label>
              <label className="md:col-span-2 xl:col-span-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Description</span><textarea name="description" className={textareaClass} /></label>
              <label className="md:col-span-2 xl:col-span-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Tags</span><input name="tags" placeholder="cell-culture, qc" className={inputClass} /></label>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Method content" eyebrow="First version" />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Purpose</span><textarea name="purpose" className={textareaClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Background</span><textarea name="background" className={textareaClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Method scope</span><textarea name="methodScope" className={textareaClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes</span><textarea name="notes" className={textareaClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Materials · one per line</span><textarea name="materials" placeholder="Material | amount, unit, or note" className={textareaClass} /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Steps · one per line</span><textarea name="steps" placeholder="Step title | detailed instruction" className={textareaClass} /></label>
            </CardBody>
          </Card>
          <div className="flex justify-end"><button className="focus-ring h-10 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm">Create protocol</button></div>
        </form>
      </div>
    </AppShell>
  );
}

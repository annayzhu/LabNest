import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";

const protocolStatuses = ["draft", "active", "retired", "archived"] as const;
const recordStatuses = ["draft", "recorded", "submitted", "reviewed"] as const;
const parameterTypes = ["number", "text", "select", "entity", "boolean"] as const;

const createProtocolFormSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  status: z.enum(protocolStatuses).default("draft"),
  recordStatus: z.enum(recordStatuses).default("draft"),
  tags: z.array(z.string().trim().min(1).max(48)).default([]),
  purpose: z.string().trim().optional(),
  background: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  parametersRaw: z.string().optional(),
  materialsRaw: z.string().optional(),
  stepsRaw: z.string().optional(),
});

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseParameterType(value: string) {
  return parameterTypes.includes(value as (typeof parameterTypes)[number])
    ? (value as (typeof parameterTypes)[number])
    : "text";
}

function parseDefaultValue(type: (typeof parameterTypes)[number], value?: string) {
  if (value === undefined || value === "") return undefined;
  if (type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === "boolean") return value === "true";
  return value;
}

function parseParameters(raw = "") {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, typeRaw = "text", defaultRaw] = line.split(":").map((part) => part.trim());
      const type = parseParameterType(typeRaw);

      return {
        name,
        type,
        default: parseDefaultValue(type, defaultRaw),
        required: true,
      };
    });
}

function parseMaterials(raw = "") {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, unit, role] = line.split(":").map((part) => part.trim());

      return {
        name,
        unit: unit || undefined,
        role: role || undefined,
      };
    });
}

function parseSteps(raw = "") {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, description] = line.split("|").map((part) => part.trim());

      return {
        order: index + 1,
        title,
        description: description || title,
        requires_confirmation: true,
        allows_deviation: true,
      };
    });
}

async function createProtocol(formData: FormData) {
  "use server";

  const parsed = createProtocolFormSchema.parse({
    title: formData.get("title"),
    description: String(formData.get("description") ?? "").trim() || undefined,
    projectId: String(formData.get("projectId") ?? "").trim() || undefined,
    status: formData.get("status") || "draft",
    recordStatus: formData.get("recordStatus") || "draft",
    tags: parseTags(formData.get("tags")),
    purpose: String(formData.get("purpose") ?? "").trim() || undefined,
    background: String(formData.get("background") ?? "").trim() || undefined,
    scope: String(formData.get("scope") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    parametersRaw: String(formData.get("parametersRaw") ?? ""),
    materialsRaw: String(formData.get("materialsRaw") ?? ""),
    stepsRaw: String(formData.get("stepsRaw") ?? ""),
  });

  const purpose = parsed.purpose || parsed.description || "Protocol purpose to be filled during method review.";
  const background = parsed.background || "Background not recorded yet.";
  const scope = parsed.scope || "Personal and small-lab use.";
  const notes = parsed.notes || "Initial protocol version created from the LabNest form.";

  await prisma.protocol.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      recordStatus: parsed.recordStatus,
      projectId: parsed.projectId,
      tags: parsed.tags,
      versions: {
        create: {
          versionNumber: 1,
          recordStatus: parsed.recordStatus,
          changeSummary: "Initial protocol version.",
          title: `${parsed.title} v1`,
          purpose,
          background,
          scope,
          notes,
          parametersJson: parseParameters(parsed.parametersRaw),
          materialsJson: parseMaterials(parsed.materialsRaw),
          equipmentJson: [],
          stepsJson: parseSteps(parsed.stepsRaw),
          consumptionRulesJson: [],
          resultTemplatesJson: [],
        },
      },
    },
  });

  revalidatePath("/protocols");
  revalidatePath("/search");
  redirect("/protocols");
}

export default async function NewProtocolPage() {
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="New protocol"
          title="Add Protocol"
          description="Create a versioned method record with an initial v1 draft."
        />

        <Card>
          <CardHeader title="Protocol" eyebrow="Versioned record" />
          <CardBody>
            <form action={createProtocol} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Title</span>
                  <input
                    required
                    name="title"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                    placeholder="Protocol title"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Project</span>
                  <select
                    name="projectId"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Description</span>
                <input
                  name="description"
                  className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  placeholder="Short method summary"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Status</span>
                  <select
                    name="status"
                    defaultValue="draft"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    {protocolStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Record</span>
                  <select
                    name="recordStatus"
                    defaultValue="draft"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    {recordStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Tags</span>
                  <input
                    name="tags"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                    placeholder="PCR, cloning"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Purpose</span>
                  <textarea
                    name="purpose"
                    className="focus-ring mt-2 min-h-28 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Background</span>
                  <textarea
                    name="background"
                    className="focus-ring mt-2 min-h-28 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Scope</span>
                  <textarea
                    name="scope"
                    className="focus-ring mt-2 min-h-24 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes</span>
                  <textarea
                    name="notes"
                    className="focus-ring mt-2 min-h-24 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Parameters</span>
                  <textarea
                    name="parametersRaw"
                    className="focus-ring mt-2 min-h-36 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-5 text-ink"
                    placeholder="well_count:number:2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Materials</span>
                  <textarea
                    name="materialsRaw"
                    className="focus-ring mt-2 min-h-36 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-5 text-ink"
                    placeholder="Complete DMEM:mL:culture medium"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Steps</span>
                  <textarea
                    name="stepsRaw"
                    className="focus-ring mt-2 min-h-36 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-5 text-ink"
                    placeholder="Seed cells|Seed cells at the planned density."
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95">
                  Save Protocol
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

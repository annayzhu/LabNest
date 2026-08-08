import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { calculateConsumption, type ProtocolParameterValues } from "@/lib/protocol";
import type { ConsumptionRule, ProtocolMaterial, ProtocolParameter, ProtocolStep, ResultTemplate } from "@/lib/types";
import { entrySchema } from "@/lib/validation";
import { z } from "zod";

const sourceTypes = ["text", "photo", "file", "voice", "manual"] as const;
const recordStatuses = ["draft", "recorded", "submitted", "reviewed"] as const;
const experimentStatuses = ["planned", "running", "completed", "failed", "archived"] as const;

const createEntryFormSchema = entrySchema.extend({
  recordStatus: z.enum(recordStatuses).default("recorded"),
  moodStatus: z.string().trim().optional(),
  researchPlanId: z.string().trim().optional(),
  protocolVersionId: z.string().trim().optional(),
  experimentTitle: z.string().trim().optional(),
  experimentStatus: z.enum(experimentStatuses).default("running"),
  resultTitle: z.string().trim().optional(),
  resultType: z.string().trim().optional(),
  resultTextValue: z.string().trim().optional(),
  resultNotes: z.string().trim().optional(),
});

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parameterDefaults(parameters: ProtocolParameter[]): ProtocolParameterValues {
  return parameters.reduce<ProtocolParameterValues>((values, parameter) => {
    if (parameter.default !== undefined) {
      values[parameter.name] = parameter.default;
    }

    return values;
  }, {});
}

function materialSummary(materials: ProtocolMaterial[]) {
  return materials.map((material) => [material.name, material.unit, material.role].filter(Boolean).join(" / ")).join("\n");
}

async function createEntry(formData: FormData) {
  "use server";

  const parsed = createEntryFormSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    projectId: String(formData.get("projectId") ?? "") || undefined,
    tags: parseTags(formData.get("tags")),
    sourceType: formData.get("sourceType") || "text",
    recordStatus: formData.get("recordStatus") || "recorded",
    moodStatus: String(formData.get("moodStatus") ?? "").trim() || undefined,
    researchPlanId: String(formData.get("researchPlanId") ?? "").trim() || undefined,
    protocolVersionId: String(formData.get("protocolVersionId") ?? "").trim() || undefined,
    experimentTitle: String(formData.get("experimentTitle") ?? "").trim() || undefined,
    experimentStatus: formData.get("experimentStatus") || "running",
    resultTitle: String(formData.get("resultTitle") ?? "").trim() || undefined,
    resultType: String(formData.get("resultType") ?? "").trim() || undefined,
    resultTextValue: String(formData.get("resultTextValue") ?? "").trim() || undefined,
    resultNotes: String(formData.get("resultNotes") ?? "").trim() || undefined,
  });

  const entry = await prisma.entry.create({
    data: {
      title: parsed.title,
      body: parsed.body,
      projectId: parsed.projectId,
      researchPlanId: parsed.researchPlanId,
      tags: parsed.tags,
      sourceType: parsed.sourceType,
      recordStatus: parsed.recordStatus,
      moodStatus: parsed.moodStatus,
    },
  });

  if (parsed.protocolVersionId) {
    const version = await prisma.protocolVersion.findUnique({
      where: { id: parsed.protocolVersionId },
      include: { protocol: true },
    });

    if (!version) {
      throw new Error("Selected protocol version does not exist.");
    }

    const parameters = asArray<ProtocolParameter>(version.parametersJson);
    const materials = asArray<ProtocolMaterial>(version.materialsJson);
    const steps = asArray<ProtocolStep>(version.stepsJson);
    const resultTemplates = asArray<ResultTemplate>(version.resultTemplatesJson);
    const consumptionRules = asArray<ConsumptionRule>(version.consumptionRulesJson);
    const parameterValues = parameterDefaults(parameters);
    const calculatedConsumption = (() => {
      try {
        return calculateConsumption(consumptionRules, parameterValues);
      } catch {
        return [];
      }
    })();
    const experimentTitle = parsed.experimentTitle || parsed.title;
    const projectId = parsed.projectId ?? version.protocol.projectId;
    const researchPlanId = parsed.researchPlanId ?? (
      projectId
        ? (await prisma.researchPlan.findFirst({
            where: { projectId, status: { in: ["active", "draft"] } },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          }))?.id
        : undefined
    );

    const experiment = await prisma.experiment.create({
      data: {
        title: experimentTitle,
        projectId,
        researchPlanId,
        status: parsed.experimentStatus,
        recordStatus: "recorded",
        purpose: parsed.title,
        background: `Created from entry ${entry.id}.`,
        materialsText: materialSummary(materials),
        observations: parsed.body,
        resultSummary: resultTemplates.length ? "Result records registered from protocol template." : "Result registration pending.",
        primaryProtocolVersionId: version.id,
        tags: Array.from(new Set([...parsed.tags, "from-entry", "protocol-based"])),
        steps: {
          create: steps.map((step) => ({
            protocolStepRef: String(step.order),
            order: step.order,
            title: step.title,
            description: step.description,
          })),
        },
        protocolVersions: {
          create: { protocolVersionId: version.id, role: "primary", order: 0 },
        },
      },
    });

    const protocolRun = await prisma.protocolRun.create({
      data: {
        protocolVersionId: version.id,
        experimentId: experiment.id,
        parametersJson: parameterValues,
        calculatedConsumptionJson: calculatedConsumption,
        status: parsed.experimentStatus,
      },
    });

    await prisma.itemLink.createMany({
      data: [
        {
          sourceType: "entry",
          sourceId: entry.id,
          targetType: "experiment",
          targetId: experiment.id,
          linkType: "formalized_as",
          createdBy: "user",
          note: "Entry was recorded as a protocol-based formal experiment.",
        },
        {
          sourceType: "experiment",
          sourceId: experiment.id,
          targetType: "protocol_version",
          targetId: version.id,
          linkType: "derived_from",
          createdBy: "system",
          note: "Experiment was created from a locked protocol version.",
        },
      ],
    });

    if (calculatedConsumption.length) {
      await prisma.proposedAction.createMany({
        data: calculatedConsumption.map((item) => ({
          sourceType: "protocol",
          sourceId: protocolRun.id,
          actionType: "consume_inventory",
          status: "pending",
          confidence: 1,
          reason: `Calculated from ${item.formula}; review inventory source before execution.`,
          payloadJson: {
            protocol_run_id: protocolRun.id,
            experiment_id: experiment.id,
            material_name: item.materialName,
            quantity_change: -item.quantity,
            unit: item.unit,
            requires_inventory_selection: item.requiresInventorySelection,
          },
        })),
      });
    }

    const templateResults = resultTemplates.map((template) => ({
      experimentId: experiment.id,
      projectId,
      resultType: template.result_type,
      title: `${experimentTitle} - ${template.result_type}`,
      textValue: null,
      status: "active" as const,
      notes: "Result registration created from protocol template; no measurement recorded yet.",
      metadataJson: {
        source_entry_id: entry.id,
        protocol_version_id: version.id,
        template_fields: template.fields,
      },
    }));
    const manualResult =
      parsed.resultTitle || parsed.resultType || parsed.resultTextValue || parsed.resultNotes
        ? [
            {
              experimentId: experiment.id,
              projectId,
              resultType: parsed.resultType || "manual_result",
              title: parsed.resultTitle || `${experimentTitle} result`,
              textValue: parsed.resultTextValue,
              status: "active" as const,
              notes: parsed.resultNotes || "Initial result field created during entry capture.",
              metadataJson: { source_entry_id: entry.id, protocol_version_id: version.id },
            },
          ]
        : [];

    if (templateResults.length || manualResult.length) {
      await prisma.result.createMany({ data: [...templateResults, ...manualResult] });
    }
  }

  revalidatePath("/entries");
  revalidatePath("/experiments");
  revalidatePath("/results");
  revalidatePath("/search");
  redirect("/entries");
}

export default async function NewEntryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const source = firstSearchParam(params, "source");
  const protocolVersionId = firstSearchParam(params, "protocolVersionId");
  const defaultSource = sourceTypes.includes(source as (typeof sourceTypes)[number]) ? source : "text";
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });
  const researchPlans = await prisma.researchPlan.findMany({
    include: { project: true },
    orderBy: [{ project: { name: "asc" } }, { title: "asc" }],
  });
  const protocols = await prisma.protocol.findMany({
    include: { versions: { orderBy: { revision: "desc" } } },
    orderBy: { title: "asc" },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="New entry"
          title="Add Entry"
          description="Capture a lab note, or record it as a protocol-based formal experiment."
        />

        <Card>
          <CardHeader title="Entry" eyebrow="Manual record" />
          <CardBody>
            <form action={createEntry} className="grid gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Title</span>
                <input
                  required
                  name="title"
                  className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  placeholder="Short lab note title"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Body</span>
                <textarea
                  required
                  name="body"
                  className="focus-ring mt-2 min-h-52 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
                  placeholder="Observation, decision, deviation, or follow-up."
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Research plan</span>
                  <select
                    name="researchPlanId"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    <option value="">Unassigned</option>
                    {researchPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.project.name} · {plan.code ?? plan.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Source</span>
                  <select
                    name="sourceType"
                    defaultValue={defaultSource}
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    {sourceTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Record</span>
                  <select
                    name="recordStatus"
                    defaultValue="recorded"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  >
                    {recordStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">State</span>
                  <input
                    name="moodStatus"
                    className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                    placeholder="needs follow-up"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Tags</span>
                <input
                  name="tags"
                  className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                  placeholder="transfection, observation"
                />
              </label>

              <section className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-xl font-medium text-ink">Protocol-Based Experiment</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol version</span>
                    <select
                      name="protocolVersionId"
                      defaultValue={protocolVersionId ?? ""}
                      className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm text-ink"
                    >
                      <option value="">Standalone entry</option>
                      {protocols.map((protocol) =>
                        protocol.versions.map((version) => (
                          <option key={version.id} value={version.id}>
                            {protocol.humanCode ?? protocol.title} / {version.displayVersion} / {version.reviewStage}
                          </option>
                        )),
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Experiment title</span>
                    <input
                      name="experimentTitle"
                      className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm text-ink"
                      placeholder="Defaults to entry title"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Experiment status</span>
                    <select
                      name="experimentStatus"
                      defaultValue="running"
                      className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm text-ink"
                    >
                      {experimentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Result title</span>
                    <input
                      name="resultTitle"
                      className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm text-ink"
                      placeholder="Optional first result"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Result type</span>
                    <input
                      name="resultType"
                      className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm text-ink"
                      placeholder="fluorescence_expression"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Initial result text</span>
                    <textarea
                      name="resultTextValue"
                      className="focus-ring mt-2 min-h-24 w-full resize-y rounded-[8px] border border-hairline bg-surface p-3 text-sm leading-6 text-ink"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Result notes</span>
                    <textarea
                      name="resultNotes"
                      className="focus-ring mt-2 min-h-20 w-full resize-y rounded-[8px] border border-hairline bg-surface p-3 text-sm leading-6 text-ink"
                    />
                  </label>
                </div>
              </section>

              <div className="flex justify-end">
                <button className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95">
                  Save Entry
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

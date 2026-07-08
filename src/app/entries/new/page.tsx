import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { entrySchema } from "@/lib/validation";
import { z } from "zod";

const sourceTypes = ["text", "photo", "file", "voice", "manual"] as const;
const recordStatuses = ["draft", "recorded", "submitted", "reviewed"] as const;

const createEntryFormSchema = entrySchema.extend({
  recordStatus: z.enum(recordStatuses).default("recorded"),
  moodStatus: z.string().trim().optional(),
});

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
  });

  await prisma.entry.create({
    data: {
      title: parsed.title,
      body: parsed.body,
      projectId: parsed.projectId,
      tags: parsed.tags,
      sourceType: parsed.sourceType,
      recordStatus: parsed.recordStatus,
      moodStatus: parsed.moodStatus,
    },
  });

  revalidatePath("/entries");
  revalidatePath("/search");
  redirect("/entries");
}

export default async function NewEntryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const source = firstSearchParam(params, "source");
  const defaultSource = sourceTypes.includes(source as (typeof sourceTypes)[number]) ? source : "text";
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="New entry"
          title="Add Entry"
          description="Capture a lab note now; link and convert it later."
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

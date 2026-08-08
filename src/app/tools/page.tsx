import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { labToolManifest } from "@/lib/tool-manifest";

export default function ToolsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Experimental utilities"
          title="Tools"
          description="A focused directory of standalone planning and analysis applications. Each tool keeps an independent release cycle; LabNest supplies context, launch, and later result provenance."
        />

        {(["Planning", "Analysis"] as const).map((category) => {
          const tools = labToolManifest.filter((tool) => tool.category === category);
          return (
            <Card key={category}>
              <CardHeader title={category} eyebrow={category === "Planning" ? "Before the experiment" : "After data acquisition"} />
              <CardBody className="divide-y divide-hairline p-0">
                {tools.map((tool) => (
                  <article key={tool.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg font-medium text-ink">{tool.name}</h3>
                        <Badge>v{tool.version}</Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-graphite">{tool.description}</p>
                    </div>
                    <div className="text-xs leading-5 text-muted">
                      <p><span className="font-semibold text-graphite">Input:</span> {tool.accepts.join(" · ")}</p>
                      <p><span className="font-semibold text-graphite">Output:</span> {tool.produces.join(" · ")}</p>
                    </div>
                    {tool.launchUrl ? (
                      <Link
                        href={tool.launchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-3 text-sm font-medium text-warm"
                      >
                        Open <ExternalLink className="h-4 w-4" aria-hidden />
                      </Link>
                    ) : (
                      <Badge tone="warning">Not connected</Badge>
                    )}
                  </article>
                ))}
              </CardBody>
            </Card>
          );
        })}

        <p className="text-xs leading-5 text-muted">
          Tool endpoints are configured through environment variables. External applications open in a separate tab so failures or upgrades cannot destabilize the LabNest workspace.
        </p>
      </div>
    </AppShell>
  );
}

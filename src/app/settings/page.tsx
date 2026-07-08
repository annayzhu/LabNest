import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { aiProviders, referenceConnectors } from "@/lib/demo-data";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Configuration console"
          title="Settings"
          description="LabNest keeps adapters optional: AI can draft proposed actions, and literature managers stay external through Zotero or EndNote connectors."
        />

        <Card>
          <CardHeader title="Manual-first AI Boundary" eyebrow="Safety model" />
          <CardBody className="grid gap-4 md:grid-cols-3">
            {[
              ["Manual workflows stay complete", "Entries, protocols, runs, inventory, results, and exports remain usable when AI is disabled."],
              ["AI cannot mutate records", "AI tasks and protocol calculations can only generate proposed actions for user review."],
              ["Subscriptions are not APIs", "ChatGPT/Claude web subscriptions use manual copy-paste mode; the app does not automate web login."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-lg font-medium text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-graphite">{body}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Providers" eyebrow="Adapters" />
          <CardBody>
            <DataTable
              rows={aiProviders}
              getRowKey={(row) => row.id}
              columns={[
                { key: "name", header: "Provider", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type.replaceAll("_", " ")}</Badge> },
                { key: "base", header: "Base URL", render: (row) => <span className="font-mono text-xs">{row.baseUrl ?? "manual"}</span> },
                { key: "key", header: "API key", render: (row) => <span className="font-mono text-xs">{row.maskedKey ?? "not stored"}</span> },
                { key: "model", header: "Default model", render: (row) => row.defaultModel },
                {
                  key: "enabled",
                  header: "Enabled",
                  render: (row) => <Badge tone={row.enabled ? "success" : "neutral"}>{row.enabled ? "enabled" : "disabled"}</Badge>,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Literature Connectors" eyebrow="External libraries" />
          <CardBody>
            <DataTable
              rows={referenceConnectors}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Connector",
                  render: (row) => <span className="font-semibold text-ink">{row.displayName}</span>,
                },
                { key: "provider", header: "Provider", render: (row) => <Badge tone="sage">{row.provider}</Badge> },
                { key: "scope", header: "Scope", render: (row) => row.libraryScope ?? "not set" },
                {
                  key: "endpoint",
                  header: "Endpoint",
                  render: (row) => <span className="font-mono text-xs">{row.baseUrl ?? "file import"}</span>,
                },
                {
                  key: "enabled",
                  header: "Enabled",
                  render: (row) => <Badge tone={row.enabled ? "success" : "neutral"}>{row.enabled ? "enabled" : "disabled"}</Badge>,
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

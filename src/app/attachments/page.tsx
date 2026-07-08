import { Download, Paperclip } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getAttachments() {
  try {
    return await prisma.attachment.findMany({
      include: { links: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
  } catch {
    return [];
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AttachmentsPage() {
  const attachments = await getAttachments();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Files"
          title="Attachments"
          description="Upload local files and link them to records without leaving the notebook."
        />

        <Card>
          <CardHeader title="Upload" eyebrow="Local storage" />
          <CardBody>
            <AttachmentUploadForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent Files" eyebrow={`${attachments.length} stored`} />
          <CardBody>
            <DataTable
              rows={attachments}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "file",
                  header: "File",
                  render: (row) => (
                    <div className="flex items-start gap-3">
                      <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
                      <div>
                        <p className="font-semibold text-ink">{row.originalFilename}</p>
                        <p className="mt-1 font-mono text-xs text-muted">{row.filename}</p>
                      </div>
                    </div>
                  ),
                },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.mimeType}</Badge> },
                { key: "size", header: "Size", render: (row) => <span className="font-mono">{formatBytes(row.size)}</span> },
                {
                  key: "links",
                  header: "Links",
                  render: (row) =>
                    row.links.length ? (
                      <div className="flex flex-wrap gap-2">
                        {row.links.map((link) => (
                          <Badge key={link.id} tone="neutral">
                            {link.targetType}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge tone="neutral">unlinked</Badge>
                    ),
                },
                {
                  key: "uploaded",
                  header: "Uploaded",
                  render: (row) => <span className="font-mono text-xs">{row.uploadedAt.toISOString()}</span>,
                },
                {
                  key: "download",
                  header: "",
                  render: (row) => (
                    <a
                      href={`/api/attachments/${row.id}`}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-hairline bg-surface text-moss transition hover:bg-sage-surface"
                      title={`Download ${row.originalFilename}`}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Download {row.originalFilename}</span>
                    </a>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

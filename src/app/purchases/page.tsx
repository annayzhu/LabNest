import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { procurementInquiries, procurementQuoteLines, purchases } from "@/lib/demo-data";
import {
  getInquirySummary,
  getQuoteLineAmountInclTax,
  groupSelectedQuoteLinesBySupplier,
  toSchoolSelfPurchaseRow,
  validateSchoolSelfPurchaseRow,
} from "@/lib/procurement";
import { Download } from "lucide-react";

function money(value: number | undefined) {
  return value === undefined ? "not set" : `￥${value.toFixed(2)}`;
}

export default function PurchasesPage() {
  const inquiryRows = procurementInquiries.map((inquiry) => ({
    ...inquiry,
    summary: getInquirySummary(inquiry, procurementQuoteLines),
  }));
  const selectedGroups = groupSelectedQuoteLinesBySupplier(procurementQuoteLines);
  const exportRows = selectedGroups.flatMap((group) =>
    group.quoteLines.map((line) => {
      const row = toSchoolSelfPurchaseRow(line);
      return {
        id: line.id,
        supplierName: group.supplierName,
        row,
        issues: validateSchoolSelfPurchaseRow(row),
      };
    }),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Procurement"
          title="Purchases"
          description="Inquiry spreadsheets stay lightweight. Only selected quote lines become purchase requests, school import rows, and later inventory transactions."
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Inquiry sheets" value={procurementInquiries.length} />
          <Metric label="Quote lines" value={procurementQuoteLines.length} />
          <Metric label="Selected lines" value={procurementQuoteLines.filter((line) => line.status === "selected").length} />
          <Metric label="School files" value={selectedGroups.length} />
        </section>

        <Card>
          <CardHeader title="Inquiry Sheets" eyebrow="Excel-first capture" />
          <CardBody>
            <DataTable
              rows={inquiryRows}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "title",
                  header: "Inquiry",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-ink">{row.title}</p>
                      <p className="mt-1 font-mono text-xs text-muted">{row.importedFileName ?? "manual"}</p>
                    </div>
                  ),
                },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "rows", header: "Rows", render: (row) => <span className="font-mono">{row.summary.rowCount}</span> },
                { key: "selected", header: "Selected", render: (row) => <span className="font-mono">{row.summary.selectedCount}</span> },
                { key: "suppliers", header: "Suppliers", render: (row) => <span className="font-mono">{row.summary.supplierCount}</span> },
                {
                  key: "amount",
                  header: "Selected total",
                  render: (row) => <span className="font-mono">{money(row.summary.selectedAmountInclTax)}</span>,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quote Lines" eyebrow="Not inventory or reimbursement records" />
          <CardBody>
            <DataTable
              rows={procurementQuoteLines}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "item",
                  header: "Item",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-ink">{row.productName}</p>
                      <p className="mt-1 text-xs text-muted">{row.specification ?? row.catalogNumber ?? "no specification"}</p>
                    </div>
                  ),
                },
                { key: "supplier", header: "Supplier", render: (row) => row.supplierName ?? "not set" },
                { key: "category", header: "Category", render: (row) => <Badge tone="sage">{row.productCategory ?? "unmapped"}</Badge> },
                {
                  key: "amount",
                  header: "Total",
                  render: (row) => <span className="font-mono">{money(getQuoteLineAmountInclTax(row))}</span>,
                },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "reason", header: "Decision", render: (row) => row.decisionReason ?? "not reviewed" },
              ]}
            />
          </CardBody>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
          <Card>
            <CardHeader title="School Import Groups" eyebrow="One supplier per file" />
            <CardBody className="space-y-3">
              {selectedGroups.map((group) => (
                <div key={group.supplierName} className="rounded-[10px] border border-hairline bg-warm p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{group.supplierName}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone="success">{group.quoteLines.length} rows</Badge>
                      <a
                        href={`/purchases/school-template?supplier=${encodeURIComponent(group.supplierName)}`}
                        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-hairline bg-surface text-moss transition hover:bg-sage-surface"
                        title={`Download ${group.supplierName} self-purchase .xlsx`}
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Download {group.supplierName} self-purchase .xlsx</span>
                      </a>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted">
                    {group.quoteLines.map((line) => line.productName).join(" / ")}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Self-Purchase Template Preview" eyebrow="ZJU-compatible rows" />
            <CardBody>
              <DataTable
                rows={exportRows}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "supplier", header: "Supplier", render: (row) => row.supplierName },
                  { key: "category", header: "产品分类*", render: (row) => row.row["产品分类*"] },
                  { key: "name", header: "商品名称*", render: (row) => <span className="font-semibold text-ink">{row.row["商品名称*"]}</span> },
                  {
                    key: "qty",
                    header: "数量 / 单位",
                    render: (row) => (
                      <span className="font-mono">
                        {row.row["数量*"]} {row.row["包装单位*"]}
                      </span>
                    ),
                  },
                  { key: "amount", header: "未税 / 税额", render: (row) => <span className="font-mono">{money(row.row["未税金额(元)*"])} / {money(row.row["税额(元)*"])}</span> },
                  {
                    key: "issues",
                    header: "Check",
                    render: (row) => (
                      <Badge tone={row.issues.length ? "danger" : "success"}>
                        {row.issues.length ? `${row.issues.length} issues` : "ready"}
                      </Badge>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </section>

        <Card>
          <CardHeader title="Purchase Requests" eyebrow="Pending and received" />
          <CardBody>
            <DataTable
              rows={purchases}
              getRowKey={(row) => row.id}
              columns={[
                { key: "title", header: "Request", render: (row) => <span className="font-semibold text-ink">{row.title}</span> },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "vendor", header: "Vendor", render: (row) => row.vendor ?? "not set" },
                {
                  key: "qty",
                  header: "Quantity",
                  render: (row) => (
                    <span className="font-mono">
                      {row.quantity} {row.unit}
                    </span>
                  ),
                },
                { key: "price", header: "Price", render: (row) => <span className="font-mono">{money(row.price)}</span> },
                { key: "catalog", header: "Catalog", render: (row) => <span className="font-mono text-xs">{row.catalogNumber ?? "not set"}</span> },
                { key: "source", header: "Quote", render: (row) => <span className="font-mono text-xs">{row.procurementQuoteLineId ?? "manual"}</span> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-hairline bg-surface p-4 shadow-paper">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl font-medium leading-none text-ink">{value}</p>
    </div>
  );
}

import {
  Beaker,
  BookOpen,
  Boxes,
  Database,
  FileText,
  FlaskConical,
  Link2,
  Paperclip,
  ShoppingCart,
  TestTube2,
} from "lucide-react";
import type { ItemType, RelevantItem } from "@/lib/types";
import { Badge, BadgeLink } from "./ui/Badge";
import { Card, CardBody, CardHeader } from "./ui/Card";

const icons: Record<ItemType, typeof Link2> = {
  entry: BookOpen,
  experiment: Beaker,
  protocol: FileText,
  protocol_version: FileText,
  project: Link2,
  entity: TestTube2,
  sample_profile: TestTube2,
  sample_lifecycle_event: FileText,
  inventory_item: Boxes,
  result: Database,
  purchase: ShoppingCart,
  procurement_inquiry: ShoppingCart,
  procurement_quote_line: ShoppingCart,
  reference_connector: Link2,
  sequence: FlaskConical,
  attachment: Paperclip,
  protocol_run: Beaker,
};

const collectionHref: Partial<Record<ItemType, string>> = {
  entry: "/entries",
  experiment: "/experiments",
  protocol: "/protocols",
  protocol_version: "/protocols",
  project: "/projects",
  entity: "/entities",
  sample_profile: "/samples",
  sample_lifecycle_event: "/samples",
  inventory_item: "/inventory",
  result: "/results",
  purchase: "/purchases",
  procurement_inquiry: "/purchases",
  procurement_quote_line: "/purchases",
  sequence: "/sequences",
  protocol_run: "/experiments",
};

export function RelevantItemsPanel({ items }: { items: RelevantItem[] }) {
  return (
    <Card className="sticky top-24">
      <CardHeader title="Relevant Items" eyebrow="Backlinks" />
      <CardBody className="space-y-3">
        {items.map((item) => {
          const Icon = icons[item.type] ?? Link2;
          const href = collectionHref[item.type];
          return (
            <div key={item.id} className="rounded-[10px] border border-hairline bg-warm p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sage-surface text-moss">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {href ? (
                      <BadgeLink href={href} tone="sage">
                        {item.type.replaceAll("_", " ")}
                      </BadgeLink>
                    ) : (
                      <Badge tone="sage">{item.type.replaceAll("_", " ")}</Badge>
                    )}
                    <Badge>{item.relation}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {item.createdBy}
                    {item.confidence !== undefined ? ` / ${(item.confidence * 100).toFixed(0)}%` : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

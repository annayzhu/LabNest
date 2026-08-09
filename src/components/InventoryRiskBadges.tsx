import { Badge, BadgeLink } from "@/components/ui/Badge";
import type { InventoryRiskFlag } from "@/lib/inventory";

const labels: Record<InventoryRiskFlag, string> = {
  depleted: "out of stock",
  low: "low stock",
  expired: "expired",
  expiring: "expiring soon",
};

export function InventoryRiskBadges({
  flags,
  linkToFilters = false,
  showHealthy = false,
}: {
  flags: InventoryRiskFlag[];
  linkToFilters?: boolean;
  showHealthy?: boolean;
}) {
  if (!flags.length) return showHealthy ? <Badge tone="success">healthy</Badge> : null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => linkToFilters ? (
        <BadgeLink key={flag} href={`/inventory?flag=${flag}`} tone={flag === "expired" || flag === "depleted" ? "danger" : "warning"}>
          {labels[flag]}
        </BadgeLink>
      ) : (
        <Badge key={flag} tone={flag === "expired" || flag === "depleted" ? "danger" : "warning"}>
          {labels[flag]}
        </Badge>
      ))}
    </div>
  );
}

import Link from "next/link";
import { QuantityText } from "@/components/InventoryDetail";
import { Badge, BadgeLink } from "@/components/ui/Badge";
import type { InventoryRiskFlag } from "@/lib/inventory";

const labels: Record<InventoryRiskFlag, string> = {
  depleted: "out of stock",
  low: "low stock",
  expired: "expired",
  expiring: "expiring soon",
  used_up: "used up",
};

// "Used up" is a state, not a reminder, so it reads plainly (Q239).
const tones: Record<InventoryRiskFlag, "danger" | "warning" | "neutral"> = {
  depleted: "danger",
  expired: "danger",
  low: "warning",
  expiring: "warning",
  used_up: "neutral",
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
        <BadgeLink key={flag} href={`/inventory/list?flag=${flag}`} tone={tones[flag]}>
          {labels[flag]}
        </BadgeLink>
      ) : (
        <Badge key={flag} tone={tones[flag]}>
          {labels[flag]}
        </Badge>
      ))}
    </div>
  );
}

/** The used-up lots a list leaves out, and the way to see them (Q239). */
export function UsedUpHidden({ count, href, className = "text-sm text-muted" }: { count: number; href: string; className?: string }) {
  return (
    <p className={className}>
      <span>{`${count} used-up ${count === 1 ? "lot is" : "lots are"} not shown.`}</span>{" "}
      <Link href={href} className="font-medium text-moss hover:underline">Show them</Link>
    </p>
  );
}

/** A product's stock reminder (Q241): when it is used up (a safety stock of 0), or at or below an amount. */
export function StockReminderText({ lowThreshold, unit }: { lowThreshold: number; unit: string | null }) {
  return lowThreshold === 0 ? <span>Remind when used up</span> : <><span>Safety stock</span> <QuantityText quantity={lowThreshold} unit={unit} /></>;
}

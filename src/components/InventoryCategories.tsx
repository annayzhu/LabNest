import Link from "next/link";
import type { InventoryCategory } from "@/lib/inventory-home.server";

type Categories = { groups: InventoryCategory[]; unclassified: number };

/** The 大类 and their types on the inventory home: a side panel on a desktop, folded below the stock on a phone (Q182, Q184). */
export function InventoryCategories(categories: Categories) {
  if (!categories.groups.length && !categories.unclassified) return null;
  return (
    <>
      <section aria-labelledby="inventory-categories" className="hidden overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface lg:block">
        <h2 id="inventory-categories" className="border-b border-hairline px-4 py-2.5 text-sm font-semibold text-ink">Categories</h2>
        <CategoryList {...categories} />
      </section>
      <details className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface lg:hidden">
        <summary className="focus-ring cursor-pointer px-4 py-3 text-sm font-semibold text-ink">Categories</summary>
        <div className="border-t border-hairline"><CategoryList {...categories} /></div>
      </details>
    </>
  );
}

function CategoryList({ groups, unclassified }: Categories) {
  return (
    <div className="divide-y divide-hairline">
      {groups.map((group) => (
        <div key={group.key} className="px-4 py-3">
          <Link href={group.href} className="focus-ring flex items-baseline justify-between gap-3 rounded-[var(--ln-radius-control-sm)] text-sm font-medium text-ink hover:text-moss">
            <span className="min-w-0 truncate">{group.name}</span>
            <span className="text-xs tabular-nums text-muted">{group.count}</span>
          </Link>
          {group.types.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {group.types.map((type) => (
                <li key={type.id}>
                  <Link href={type.href} className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 text-xs text-graphite hover:border-moss/40 hover:text-moss">
                    <span>{type.label}</span>
                    <span className="tabular-nums text-muted">{type.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {unclassified ? (
        <Link href="/inventory/list?group=none&status=active" className="focus-ring flex items-baseline justify-between gap-3 px-4 py-3 text-sm text-graphite hover:text-moss">
          <span>To be classified</span>
          <span className="text-xs font-semibold tabular-nums text-warning">{unclassified}</span>
        </Link>
      ) : null}
    </div>
  );
}

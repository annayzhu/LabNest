import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  className,
  emptyMessage = "No records match this view.",
}: {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  className?: string;
  emptyMessage?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-hairline bg-surface", className)}>
      <div className="overflow-x-auto editorial-scrollbar">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-stone/70 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("border-b border-hairline px-4 py-3 font-semibold", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/80">
            {rows.length ? (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="transition hover:bg-warm">
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3 align-top text-graphite", column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

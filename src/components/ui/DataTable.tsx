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
  selection,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  className?: string;
  emptyMessage?: string;
  selection?: {
    exportPath: string;
    fieldName?: string;
    label?: string;
  };
}) {
  const table = (
    <div className={cn("overflow-hidden rounded-[10px] border border-hairline bg-surface", className)}>
      <div className="overflow-x-auto editorial-scrollbar">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-stone/70 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              {selection ? <th className="w-10 border-b border-hairline px-3 py-3"><span className="sr-only">Select</span></th> : null}
              {columns.map((column) => (
                <th key={column.key} className={cn("border-b border-hairline px-4 py-3 font-medium", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/80">
            {rows.length ? (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="transition hover:bg-warm">
                  {selection ? (
                    <td className="w-10 px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        name={selection.fieldName ?? "id"}
                        value={getRowKey(row)}
                        aria-label={`Select record ${getRowKey(row)}`}
                        className="selection-checkbox focus-ring mt-0.5 h-4 w-4 rounded border-hairline accent-moss"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3 align-top text-graphite", column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="px-4 py-6 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!selection) return table;
  return (
    <form action={selection.exportPath} method="get" className="group/selection space-y-2">
      <input type="hidden" name="exportScope" value="selected" />
      {table}
      <div className="hidden justify-end group-has-[.selection-checkbox:checked]:flex">
        <button type="submit" className="focus-ring h-9 rounded-[7px] border border-moss bg-moss px-3 text-[13px] font-medium text-warm">
          {selection.label ?? "Export selected…"}
        </button>
      </div>
    </form>
  );
}

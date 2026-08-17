import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/Button";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";

const selectionExportButtonClass = buttonStyles({
  variant: "primary",
  size: "sm",
  className: "font-medium",
});

export type TableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  width?: number | string;
  minWidth?: number;
};

function columnWidth(width: number | string | undefined) {
  if (typeof width === "number") return `${width}px`;
  return width;
}

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
    <ResizableTableFrame storageKey={`datatable:${columns.map((column) => column.key).join("|")}`} className={cn("ln-data-table-frame w-full min-w-0 max-w-full [contain:inline-size]", className)}>
      <div className="w-full min-w-0 max-w-full overflow-x-auto editorial-scrollbar">
        <table className="ln-data-table">
          <colgroup>
            {selection ? <col style={{ width: "var(--ln-list-table-selection-col-width)" }} /> : null}
            {columns.map((column, index) => (
              <col key={column.key} data-resizable-column-index={selection ? index + 1 : index} style={{ width: columnWidth(column.width) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {selection ? <th className="ln-data-table-selection-col"><span className="sr-only">Select</span></th> : null}
              {columns.map((column, index) => {
                const columnIndex = selection ? index + 1 : index;
                return <th key={column.key} data-resizable-column-cell={columnIndex} className={column.className}>
                  {column.header}
                  <span data-column-resize-handle={columnIndex} data-min-width={column.minWidth ?? 72} aria-hidden />
                </th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {selection ? (
                    <td className="ln-data-table-selection-col">
                      <input
                        type="checkbox"
                        name={selection.fieldName ?? "id"}
                        value={getRowKey(row)}
                        data-selection-group={selection.exportPath}
                        aria-label={`Select record ${getRowKey(row)}`}
                        className="selection-checkbox focus-ring ln-data-table-checkbox"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="ln-data-table-empty-cell">
                  <span className="sticky left-0 block w-[calc(100vw-2rem)] text-center md:static md:w-auto">{emptyMessage}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ResizableTableFrame>
  );

  if (!selection) return table;
  return (
    <form action={selection.exportPath} method="get" className="group/selection space-y-2">
      <input type="hidden" name="exportScope" value="selected" />
      {table}
      <div className="hidden justify-end group-has-[.selection-checkbox:checked]:flex">
        <button type="submit" className={selectionExportButtonClass}>
          {selection.label ?? "Export selected…"}
        </button>
      </div>
    </form>
  );
}

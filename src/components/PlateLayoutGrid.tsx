"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { plateLegend, plateRowLabel, plateShape, plateValueKey, plateValueText, plateWellId, type PlateLayout } from "@/lib/plate-layout";
import "./plate-layout.css";

/** Interaction the editor adds to the grid; without it the grid is a picture of the plate. */
export type PlateGridHandlers = {
  selected: ReadonlySet<string>;
  onWellDown: (wellId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onRow: (row: number, event: React.MouseEvent) => void;
  onColumn: (column: number, event: React.MouseEvent) => void;
  onAll: () => void;
};

/**
 * A plate drawn as its wells, coloured by one parameter, with a legend of each value and how many wells hold it.
 * Shared by the document block, its editor, read-only pages and the run's preparation list.
 */
export function PlateLayoutGrid({ layout, handlers, caption = true }: { layout: PlateLayout; handlers?: PlateGridHandlers; caption?: boolean }) {
  // Also drawn inside editors, which the page translator skips; so the few words here are translated in place.
  const { t, locale } = useI18n();
  const { rows, columns } = plateShape(layout.plateSize);
  const legend = useMemo(() => plateLegend(layout), [layout]);
  const tones = useMemo(() => new Map(legend.map((entry) => [entry.key, entry.tone])), [legend]);
  // A small well cannot hold a name: from 48 wells up it shows the value's number in the legend, smaller plates the value itself.
  const numbered = layout.plateSize >= 48;
  const numbers = useMemo(() => new Map(legend.map((entry, index) => [entry.key, index + 1])), [legend]);
  const wellText = (value: PlateLayout["wells"][string][string] | undefined) => value === undefined ? "" : numbered ? String(numbers.get(plateValueKey(value)) ?? "") : plateValueText(value);
  const colorField = layout.fields.find((field) => field.id === layout.colorField);
  const Axis = handlers ? "button" : "span";
  const wellTitle = (id: string) => {
    const values = layout.wells[id];
    return [id, ...layout.fields.flatMap((field) => values?.[field.id] !== undefined ? [`${field.name}：${plateValueText(values[field.id])}${field.unit ? ` ${field.unit}` : ""}`] : [])].join("\n");
  };
  return <figure className="ln-plate-layout" data-size={layout.plateSize}>
    {caption ? <figcaption>
      <strong data-i18n-ignore>{layout.name || `${layout.plateSize}`}</strong>
      <span data-i18n-ignore>{locale === "zh" ? `${layout.plateSize} 孔${colorField ? ` · 按 ${colorField.name} 着色` : ""}` : `${layout.plateSize} wells${colorField ? ` · coloured by ${colorField.name}` : ""}`}</span>
    </figcaption> : null}
    <div className="ln-plate-layout-scroll">
      <div className="ln-plate-layout-grid" style={{ gridTemplateColumns: `1.5rem repeat(${columns}, minmax(0, 1fr))` }} data-interactive={handlers ? "" : undefined}
        role={handlers ? undefined : "img"} aria-label={handlers ? undefined : `${layout.name}, ${Object.keys(layout.wells).length}/${layout.plateSize}`}>
        {handlers ? <button type="button" className="ln-plate-layout-axis focus-ring" aria-label={t("Select all wells")} onClick={handlers.onAll}>⌗</button> : <span />}
        {Array.from({ length: columns }, (_, column) => <Axis key={`c${column}`} type={handlers ? "button" : undefined} className="ln-plate-layout-axis" onClick={handlers ? (event: React.MouseEvent) => handlers.onColumn(column, event) : undefined}>{column + 1}</Axis>)}
        {Array.from({ length: rows }, (_, row) => [
          <Axis key={`r${row}`} type={handlers ? "button" : undefined} className="ln-plate-layout-axis" onClick={handlers ? (event: React.MouseEvent) => handlers.onRow(row, event) : undefined}>{plateRowLabel(row)}</Axis>,
          ...Array.from({ length: columns }, (_, column) => {
            const id = plateWellId(row, column), value = layout.wells[id]?.[layout.colorField];
            const props = { className: "ln-plate-layout-well", "data-well": id, "data-filled": layout.wells[id] ? "" : undefined, "data-plate-tone": value !== undefined ? tones.get(plateValueKey(value)) : undefined, title: wellTitle(id), "data-i18n-ignore": "" };
            return handlers
              ? <button key={id} type="button" {...props} aria-pressed={handlers.selected.has(id)} aria-label={wellTitle(id).replaceAll("\n", " · ")} onPointerDown={(event) => handlers.onWellDown(id, event)}>{wellText(value)}</button>
              : <span key={id} {...props}>{wellText(value)}</span>;
          }),
        ])}
      </div>
    </div>
    {legend.length ? <ul className="ln-plate-layout-legend">{legend.map((entry, index) => <li key={entry.key}><span className="ln-plate-layout-swatch" data-plate-tone={entry.tone}>{numbered ? index + 1 : null}</span><span data-i18n-ignore>{entry.label}</span><small>{entry.count}</small></li>)}</ul> : null}
    {layout.caption ? <p className="ln-plate-layout-note" data-i18n-ignore>{layout.caption}</p> : null}
  </figure>;
}

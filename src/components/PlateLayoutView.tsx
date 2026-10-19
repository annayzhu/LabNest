'use client';
import { useEffect, useState } from 'react';
import './run-bench.css';

export type PlateAttachment = { id: string; originalFilename: string; mimeType: string };
/** The plate planner's project backup (`*_workspace_backup.json`): plates with their wells' parameters, coloured by one dimension. */
type Plate = { id: string; name: string; plateSize: number; dimensions: Array<{ id: string; name: string; unit?: string }>; colorDimension: string; wells: Record<string, Record<string, string | number>> };
const specs: Record<number, { rows: number; columns: number }> = { 6: { rows: 2, columns: 3 }, 12: { rows: 3, columns: 4 }, 24: { rows: 4, columns: 6 }, 96: { rows: 8, columns: 12 }, 384: { rows: 16, columns: 24 } };
const rowLabel = (index: number) => String.fromCharCode(65 + index);

/** Reads version 2 workspaces and the single-plate legacy shape; anything else is "not a layout". */
export function parsePlateLayouts(raw: unknown): Plate[] {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const plates = Array.isArray(source.plates) ? source.plates : [source];
  return plates.flatMap((plate): Plate[] => {
    if (!plate || typeof plate !== 'object') return [];
    const item = plate as Record<string, unknown>, size = Number(item.plateSize);
    if (!specs[size]) return [];
    const maps = item.plates && typeof item.plates === 'object' ? (item.plates as Record<string, unknown>)[String(size)] : item.wells;
    const wells: Plate['wells'] = {};
    for (const [wellId, well] of Object.entries(maps && typeof maps === 'object' ? maps as Record<string, unknown> : {})) {
      const params = well && typeof well === 'object' ? (well as { params?: unknown }).params : undefined;
      if (/^[A-Z]\d+$/.test(wellId) && params && typeof params === 'object') wells[wellId] = Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([, value]) => typeof value === 'string' || typeof value === 'number') as Array<[string, string | number]>);
    }
    const dimensions = Array.isArray(item.dimensions) ? item.dimensions.filter((d): d is { id: string; name: string; unit?: string } => Boolean(d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' && typeof (d as { name?: unknown }).name === 'string')) : [];
    return [{ id: String(item.id ?? ''), name: String(item.name ?? `${size}-well plate`), plateSize: size, dimensions, colorDimension: typeof item.colorDimension === 'string' ? item.colorDimension : dimensions[0]?.id ?? '', wells }];
  });
}

const tone = (value: string) => { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash % 5; };

/** A plate attached as a layout: the planner's backup JSON is drawn as a read-only grid; an exported image or SVG is shown as is. */
export function PlateLayoutView({ attachment }: { attachment: PlateAttachment }) {
  const [plates, setPlates] = useState<Plate[] | null | 'invalid'>(null);
  const image = attachment.mimeType.startsWith('image/');
  useEffect(() => {
    if (image) return;
    let cancelled = false;
    fetch(`/api/attachments/${attachment.id}`).then(response => response.json()).then(raw => { if (!cancelled) { const parsed = parsePlateLayouts(raw); setPlates(parsed.length ? parsed : 'invalid'); } }).catch(() => { if (!cancelled) setPlates('invalid'); });
    return () => { cancelled = true; };
  }, [attachment.id, image]);
  // The planner's export is served by our own attachment route; next/image would need a loader for it.
  // eslint-disable-next-line @next/next/no-img-element
  if (image) return <figure className="ln-plate-figure"><img src={`/api/attachments/${attachment.id}`} alt={attachment.originalFilename} loading="lazy" /></figure>;
  if (plates === null) return <p className="ln-plate-status">Loading the plate layout…</p>;
  if (plates === 'invalid') return <p className="ln-plate-status">Not a planner project backup; <a className="text-moss underline" href={`/api/attachments/${attachment.id}`}>Download the file</a></p>;
  return <div className="ln-plate-list">{plates.map(plate => {
    const spec = specs[plate.plateSize], dimension = plate.dimensions.find(d => d.id === plate.colorDimension);
    const values = new Map<string, number>();
    for (const params of Object.values(plate.wells)) { const value = String(params[plate.colorDimension] ?? ''); if (value && !values.has(value)) values.set(value, tone(value)); }
    return <figure key={plate.id || plate.name} className="ln-plate">
      <figcaption><strong>{plate.name}</strong><span>{`${plate.plateSize}-well${dimension ? ` · colored by ${dimension.name}` : ''}`}</span></figcaption>
      <div className="ln-plate-grid" style={{ gridTemplateColumns: `1.4rem repeat(${spec.columns}, minmax(0, 1fr))` }} data-size={plate.plateSize} role="img" aria-label={`${plate.name}, ${Object.keys(plate.wells).length} marked wells`}>
        <span />{Array.from({ length: spec.columns }, (_, column) => <span key={column} className="ln-plate-axis">{column + 1}</span>)}
        {Array.from({ length: spec.rows }, (_, row) => [<span key={`r${row}`} className="ln-plate-axis">{rowLabel(row)}</span>, ...Array.from({ length: spec.columns }, (_, column) => {
          const id = `${rowLabel(row)}${column + 1}`, params = plate.wells[id], value = params ? String(params[plate.colorDimension] ?? '') : '';
          const title = params ? plate.dimensions.filter(d => params[d.id] !== undefined && params[d.id] !== '').map(d => `${d.name}：${params[d.id]}${d.unit ?? ''}`).join('\n') : '';
          return <span key={id} className="ln-plate-well" data-filled={params ? '' : undefined} data-tone={value ? values.get(value) : undefined} title={title ? `${id}\n${title}` : id}>{value.slice(0, 6)}</span>;
        })])}
      </div>
      {values.size ? <ul className="ln-plate-legend">{[...values].map(([value, index]) => <li key={value} data-tone={index}><span className="ln-plate-swatch" />{value}</li>)}</ul> : null}
    </figure>;
  })}</div>;
}

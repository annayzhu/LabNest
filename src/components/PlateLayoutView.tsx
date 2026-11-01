'use client';
import { useEffect, useState } from 'react';
import { plateLayoutsFromPlannerBackup, type PlateLayout } from '@/lib/plate-layout';
import { PlateLayoutGrid } from './PlateLayoutGrid';
import './run-bench.css';

export type PlateAttachment = { id: string; originalFilename: string; mimeType: string };

/** A planner file attached to an experiment before plates were written in the record: a project backup drawn as its plates, an exported image or SVG shown as is. */
export function PlateLayoutView({ attachment }: { attachment: PlateAttachment }) {
  const [plates, setPlates] = useState<PlateLayout[] | null | 'invalid'>(null);
  const image = attachment.mimeType.startsWith('image/');
  useEffect(() => {
    if (image) return;
    let cancelled = false;
    fetch(`/api/attachments/${attachment.id}`).then(response => response.json()).then(raw => { if (!cancelled) { const parsed = plateLayoutsFromPlannerBackup(raw, () => attachment.id); setPlates(parsed.length ? parsed : 'invalid'); } }).catch(() => { if (!cancelled) setPlates('invalid'); });
    return () => { cancelled = true; };
  }, [attachment.id, image]);
  // The planner's export is served by our own attachment route; next/image would need a loader for it.
  // eslint-disable-next-line @next/next/no-img-element
  if (image) return <figure className="ln-plate-figure"><img src={`/api/attachments/${attachment.id}`} alt={attachment.originalFilename} loading="lazy" /></figure>;
  if (plates === null) return <p className="ln-plate-status">Loading the plate layout…</p>;
  if (plates === 'invalid') return <p className="ln-plate-status">Not a planner project backup; <a className="text-moss underline" href={`/api/attachments/${attachment.id}`}>Download the file</a></p>;
  return <div className="ln-plate-list">{plates.map((plate, index) => <PlateLayoutGrid key={`${plate.id}-${index}`} layout={plate} />)}</div>;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, CloudDownload, Download, FileText, X } from 'lucide-react';
import { OfflineCalculator } from '@/components/calculators/OfflineCalculator';
import { preparationChecklist, preparationPlates, type PreparationStock } from '@/lib/run-preparation';
import { preparationWorkbook } from '@/lib/run-preparation-workbook';
import type { StructuredRunView } from '@/lib/structured-run';
import { PageActionsMenu } from './PageActionsMenu';
import { useI18n } from './I18nProvider';
import './run-bench.css';

/**
 * The run page's ··· menu: the 操作工作簿 (preparation list, mix cards and what needs care, ticks included) and this
 * experiment's offline copy. Neither is needed while working a step, so neither sits on the page. Below 1280 px the header's
 * 现场模式 and 实验记录 links move in here too, so the buttons that matter at the bench are never cut off (Q348).
 */
export function RunPageMenu({ view, runLabel, recordHref, plates = [], documentPlates = [], stock = [], recorded = [] }: { view: StructuredRunView; runLabel: string; recordHref: string; plates?: Array<{ id: string; originalFilename: string }>; documentPlates?: Array<{ id: string; name: string; plateSize: number }>; stock?: PreparationStock[]; recorded?: Array<{ source: string }> }) {
  const [offline, setOffline] = useState(false);
  const exportWorkbook = async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const list = preparationChecklist(view, { plates: preparationPlates(plates, documentPlates), stock, recorded });
    const sheets = preparationWorkbook(view, list, view.plan.preparation);
    await writeXlsxFile(sheets.map(sheet => ({ sheet: sheet.name, columns: sheet.widths.map(width => ({ width })),
      data: sheet.rows.map((row, index) => row.map(value => ({ value, ...(index === 0 ? { fontWeight: 'bold' as const } : {}) }))) }))).toFile(`${runLabel}-实验准备.xlsx`);
  };
  return <>
    <PageActionsMenu>
      <Link href="/protocol-run" className="ln-menu-below-xl ln-menu-above-phone"><ArrowLeft aria-hidden />Run mode</Link>
      <Link href={recordHref} className="ln-menu-below-xl"><FileText aria-hidden />Experiment record</Link>
      {view.hasSystems ? <button type="button" onClick={() => void exportWorkbook()}><Download aria-hidden />Export run workbook</button> : null}
      <button type="button" onClick={() => setOffline(true)}><CloudDownload aria-hidden />Use this experiment offline…</button>
    </PageActionsMenu>
    {offline ? <OfflineDialog onClose={() => setOffline(false)} /> : null}
  </>;
}

function OfflineDialog({ onClose }: { onClose: () => void }) {
  const { locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby="run-offline-title" className="ln-run-dialog bg-surface text-ink" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="run-offline-title">Use this experiment offline</h2><button type="button" className="focus-ring ln-run-dialog-close" aria-label="Close" onClick={onClose}><X aria-hidden /></button></header>
    <OfflineCalculator run panel zh={locale === 'zh'} />
  </dialog>, document.body);
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudDownload, Download, X } from 'lucide-react';
import { OfflineCalculator } from '@/components/calculators/OfflineCalculator';
import { preparationChecklist, type PreparationStock } from '@/lib/run-preparation';
import { preparationWorkbook } from '@/lib/run-preparation-workbook';
import type { StructuredRunView } from '@/lib/structured-run';
import { PageActionsMenu } from './PageActionsMenu';
import { useI18n } from './I18nProvider';
import './run-bench.css';

/**
 * The run page's ··· menu: the 操作工作簿 (preparation list, mix cards and what needs care, ticks included) and this
 * experiment's offline copy. Neither is needed while working a step, so neither sits on the page.
 */
export function RunPageMenu({ view, runLabel, plates = [], stock = [], recorded = [] }: { view: StructuredRunView; runLabel: string; plates?: Array<{ id: string; originalFilename: string }>; stock?: PreparationStock[]; recorded?: Array<{ source: string }> }) {
  const [offline, setOffline] = useState(false);
  const exportWorkbook = async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const list = preparationChecklist(view, { plates: plates.map(plate => ({ id: plate.id, name: plate.originalFilename })), stock, recorded });
    const sheets = preparationWorkbook(view, list, view.plan.preparation);
    await writeXlsxFile(sheets.map(sheet => ({ sheet: sheet.name, columns: sheet.widths.map(width => ({ width })),
      data: sheet.rows.map((row, index) => row.map(value => ({ value, ...(index === 0 ? { fontWeight: 'bold' as const } : {}) }))) }))).toFile(`${runLabel}-实验准备.xlsx`);
  };
  return <>
    <PageActionsMenu>
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

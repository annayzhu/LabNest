'use client';
import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './I18nProvider';
import { plateValueText, type PlateLayout } from '@/lib/plate-layout';
import type { EmbeddedToolId } from '@/lib/tool-embeds';
import type { ToolOutputBlock } from '@/lib/tool-workflow';
import { PlateLayoutGrid } from './PlateLayoutGrid';
import { Button } from './ui/Button';
export type ToolOpener = (block?: ToolOutputBlock, anchorId?: string, insertionSection?: string, toolId?: EmbeddedToolId, plate?: PlateLayout) => void;
export const ToolEditContext = createContext<ToolOpener | null>(null);
/** What a well says: the two parameters that hold the most values, in the plate's own order. */
const wellLines = (plate: PlateLayout) => {
    const used = (id: string) => Object.values(plate.wells).filter(well => well[id] !== undefined).length;
    const top = [...plate.fields].sort((a, b) => used(b.id) - used(a.id)).slice(0, 2).map(field => field.id);
    return plate.fields.map(field => field.id).filter(id => top.includes(id) && used(id));
};
export function ToolOutput({ block }: {
    block: ToolOutputBlock;
}) {
    const edit = useContext(ToolEditContext);
    const { locale } = useI18n();
    const tr = (zh: string, en: string) => locale === 'zh' ? zh : en;
    const [expanded, setExpanded] = useState<{
        url: string;
        caption: string;
    } | null>(null);
    const [expandedPlate, setExpandedPlate] = useState<PlateLayout | null>(null);
    const preview = useRef<HTMLDialogElement>(null);
    useEffect(() => { if (expanded || expandedPlate)
        preview.current?.showModal(); }, [expanded, expandedPlate]);
    const [copied, setCopied] = useState(false);
    const [fallback, setFallback] = useState(false);
    const [newerVersion, setNewerVersion] = useState('');
    const plasmid = block.plasmid;
    useEffect(() => {
        if (!plasmid)
            return;
        let stale = false;
        void fetch(`/api/tool-workflow?plasmid=${encodeURIComponent(plasmid.productId)}`).then(response => response.ok ? response.json() : undefined).then(result => { if (!stale && result?.current && result.current.id !== plasmid.versionId)
            setNewerVersion(result.current.label); }).catch(() => undefined);
        return () => { stale = true; };
    }, [plasmid]);
    async function copy() { try {
        await navigator.clipboard.writeText(block.mixTsv!);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    catch {
        setFallback(true);
    } }
    return <section className={`tool-output tool-output-${block.toolId}`} data-tool-artifact={block.id}>
    <header className="flex flex-wrap items-center justify-between gap-2"><h3>{block.label}</h3><div className="flex gap-2" data-print-hidden>
      {edit ? <Button type="button" size="sm" onClick={() => edit(block)}>{block.toolId === 'plasmid-workbench' ? tr('在工作台打开', 'Open in workbench') : block.toolId === 'calculator' ? tr('重新计算', 'Recalculate') : block.toolId.endsWith('-analysis') ? tr('继续分析', 'Continue analysis') : tr('编辑布局', 'Edit layout')}</Button> : block.plasmid ? <a className="tool-expand-image" href={`/tools/plasmid?product=${encodeURIComponent(block.plasmid.productId)}`}>{tr('在工作台打开', 'Open in workbench')}</a> : null}
      {block.mixTsv ? <Button type="button" size="sm" onClick={() => void copy()}>{copied ? tr('已复制', 'Copied') : tr('复制配液', 'Copy mix')}</Button> : null}
    </div></header>
    {block.plates?.map(plate => <div key={plate.id}><PlateLayoutGrid layout={plate} wellLines={wellLines(plate)}/><button type="button" className="tool-expand-image" data-print-hidden onClick={() => setExpandedPlate(plate)}>{tr('查看大图', 'View larger')}</button></div>)}
    {block.images.map((image, index) => <figure key={`${block.id}-${index}`}><img src={image.url} alt={image.caption}/><figcaption>{image.caption}<button type="button" className="tool-expand-image" data-print-hidden onClick={() => setExpanded(image)}>{tr('查看大图', 'View larger')}</button></figcaption></figure>)}
    {block.table.rows.length ? <div className="tool-table-scroll"><table><thead><tr>{block.table.headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{block.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
    {block.tables?.map(table => <div key={table.title} className="tool-table-scroll"><h4>{table.title}</h4><table><thead><tr>{table.headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>)}
    <p className="tool-method">{block.method}</p>
    {newerVersion ? <p className="tool-method" data-print-hidden role="status">{tr(`已有新版本 ${newerVersion}，这里的图谱仍是 ${block.plasmid?.versionLabel}`, `Newer version ${newerVersion} exists; this map stays at ${block.plasmid?.versionLabel}`)}</p> : null}
    {block.plates?.length ? <details data-print-hidden><summary>{tr('孔位表', 'Well table')}</summary><div className="tool-table-scroll"><table><thead><tr><th>{tr('板', 'Plate')}</th><th>{tr('孔位', 'Well')}</th>{block.plates[0].fields.map(field => <th key={field.id}>{field.name}</th>)}</tr></thead><tbody>{block.plates.flatMap(plate => Object.entries(plate.wells).map(([wellId, well]) => <tr key={`${plate.id}-${wellId}`}><td>{plate.name}</td><td>{wellId}</td>{plate.fields.map(field => <td key={field.id}>{well[field.id] === undefined ? '' : plateValueText(well[field.id])}</td>)}</tr>))}</tbody></table></div></details> : null}
    <details data-print-hidden><summary>{tr('数据与方法', 'Data and methods')}</summary><a href={`/api/attachments/${block.sessionAttachmentId}`}>{tr('下载完整方案与处理记录 · 修订', 'Full session and processing record · rev')} {block.revision}</a>{block.dataset ? <p><a href={`/api/attachments/${block.dataset.attachmentId}`}>{tr('下载完整数据表', 'Full data table')} · {block.dataset.rowCount} {tr('行', 'rows')}</a></p> : null}{block.rawAttachments?.map(file => <p key={file.id}><a href={`/api/attachments/${file.id}`}>{file.name}</a></p>)}</details>
    {fallback ? <label data-print-hidden>{tr('复制文本', 'Copy text')}<textarea readOnly value={block.mixTsv} onFocus={e => e.target.select()} className="w-full"/></label> : null}
  {expanded || expandedPlate ? createPortal(<dialog ref={preview} className="tool-image-preview" onCancel={() => { setExpanded(null); setExpandedPlate(null); }}><header><span>{expanded?.caption ?? expandedPlate?.name}</span><Button type="button" onClick={() => { preview.current?.close(); setExpanded(null); setExpandedPlate(null); }}>{tr('关闭', 'Close')}</Button></header><div>{expanded ? <img src={expanded.url} alt={expanded.caption}/> : expandedPlate ? <PlateLayoutGrid layout={expandedPlate} caption={false} wellLines={wellLines(expandedPlate)} wellLineUnits={16}/> : null}</div></dialog>, document.body) : null}</section>;
}

'use client';
import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { QpcrOutputBlock } from '@/lib/qpcr-workflow';
import { Button } from './ui/Button';
export const QpcrEditContext = createContext<((block?: QpcrOutputBlock, anchorId?: string, insertionSection?: string) => void) | null>(null);
export function QpcrOutput({ block }: {
    block: QpcrOutputBlock;
}) {
    const edit = useContext(QpcrEditContext);
    const [expanded, setExpanded] = useState<{
        url: string;
        caption: string;
    } | null>(null);
    const preview = useRef<HTMLDialogElement>(null);
    useEffect(() => { if (expanded)
        preview.current?.showModal(); }, [expanded]);
    const [copied, setCopied] = useState(false);
    const [fallback, setFallback] = useState(false);
    async function copy() { try {
        await navigator.clipboard.writeText(block.mixTsv!);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    catch {
        setFallback(true);
    } }
    return <section className="qpcr-output" data-qpcr-artifact={block.id}>
    <header className="flex flex-wrap items-center justify-between gap-2"><h3>{block.label}</h3><div className="flex gap-2" data-print-hidden>
      {edit ? <Button type="button" size="sm" onClick={() => edit(block)}>{block.toolId === 'qpcr-analysis' ? '继续分析' : '编辑布局'}</Button> : null}
      {block.mixTsv ? <Button type="button" size="sm" onClick={() => void copy()}>{copied ? '已复制' : '复制配液'}</Button> : null}
    </div></header>
    {block.images.map((image, index) => <figure key={`${block.id}-${index}`}><img src={image.url} alt={image.caption}/><figcaption>{image.caption}<button type="button" className="qpcr-expand-image" data-print-hidden onClick={() => setExpanded(image)}>查看大图</button></figcaption></figure>)}
    {block.table.rows.length ? <div className="qpcr-table-scroll"><table><thead><tr>{block.table.headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{block.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
    <p className="qpcr-method">{block.method}</p>
    <details data-print-hidden><summary>数据与方法</summary><a href={`/api/attachments/${block.sessionAttachmentId}`}>下载完整方案与处理记录 · 修订 {block.revision}</a>{block.dataset ? <p><a href={`/api/attachments/${block.dataset.attachmentId}`}>下载完整数据表 · {block.dataset.rowCount} 行</a></p> : null}{block.rawAttachments?.map(file => <p key={file.id}><a href={`/api/attachments/${file.id}`}>{file.name}</a></p>)}</details>
    {fallback ? <label data-print-hidden>复制文本<textarea readOnly value={block.mixTsv} onFocus={e => e.target.select()} className="w-full"/></label> : null}
  {expanded ? createPortal(<dialog ref={preview} className="qpcr-image-preview" onCancel={() => setExpanded(null)}><header><span>{expanded.caption}</span><Button type="button" onClick={() => { preview.current?.close(); setExpanded(null); }}>关闭</Button></header><div><img src={expanded.url} alt={expanded.caption}/></div></dialog>, document.body) : null}</section>;
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LineCheck, RecognitionCheck } from '@/lib/protocol-anchor-check';
import { formatRange, readAnchors, type AnchorRange, type SourcePage } from '@/lib/protocol-anchors';
import './recognition-draft.css';

/** The check words a line's problems in Chinese, for the repair prompt; on the page they read in English. */
export const problemLine = (problem: string): string => {
  const condition = problem.match(/^条件“([^”]*)”([\s\S]+)$/);
  if (condition) return `Condition “${condition[1]}”: ${problemLine(condition[2])}`;
  const list = (items: string) => items.split('、').join(', ');
  return problem.replace(/^原文中找不到出处（最接近的一处只对上 (\d+)%）$/, 'No source in the original (the closest place matches only $1%)')
    .replace(/^数值不在原文：([\s\S]+)$/, (_, numbers: string) => `Numbers not in the original: ${list(numbers)}`)
    .replace(/^记录项原文中找不到：([\s\S]+)$/, 'Record item not found in the original: $1')
    .replace(/^没有原文位置$/, 'No source position')
    .replace(/^原文位置不存在：([\s\S]+)$/, (_, items: string) => `Source position not found: ${list(items)}`)
    .replace(/^数值不在指向的原文：([\s\S]+)$/, (_, items: string) => `Amounts not in the cited lines: ${list(items)}`)
    .replace(/^体系取值顺序与原文不一致：([\s\S]+)$/, 'Values per system in another order than the original: $1')
    .replace(/^体系顺序与原文不一致：([\s\S]+)$/, 'Systems in another order than the original: $1')
    .replace(/^名称不在指向的原文：([\s\S]+)$/, (_, items: string) => `Names not in the cited lines: ${list(items)}`)
    .replace(/^与指向的原文只对上 (\d+)%$/, 'Only $1% matches the cited lines');
};

const sectionHeading = /^(?:说明|目的|背景|材料|步骤|结果|消耗规则)\s*[：:]\s*$/;
type Focus = AnchorRange;

/** Position chips: each one shows its source lines in the pane beside the draft. */
function Positions({ ranges, onFocus }: { ranges: AnchorRange[]; onFocus: (range: Focus) => void }) {
  return <>{ranges.map(range => <button key={formatRange(range)} type="button" className="ln-anchor focus-ring" onClick={() => onFocus(range)} aria-label={`Show ${formatRange(range)} in the original`}>{formatRange(range)}</button>)}</>;
}

/**
 * 整理稿 and 原文 side by side: the organized draft line by line, each with its source positions; a line the check could
 * not find in the lines it cites is marked unverified with the reason. The original shows every page and line as the
 * positions number them; pages that were not read are dimmed, and lines with an amount that no draft line cites are
 * marked as possibly left out.
 */
export function RecognitionDraft({ text, check, pages, readPages }: { text: string; check?: RecognitionCheck; pages: SourcePage[]; readPages?: number[] }) {
  const [focus, setFocus] = useState<Focus>();
  const pane = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => {
    const queue = new Map<string, LineCheck[]>();
    for (const line of check?.lines ?? []) queue.set(line.line, [...(queue.get(line.line) ?? []), line]);
    return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const result = queue.get(line)?.shift();
      return { line, ...readAnchors(line), heading: sectionHeading.test(line), result };
    });
  }, [text, check]);
  const missing = useMemo(() => (check?.missing ?? []).map(item => ({ item, ...readAnchors(item) })), [check]);
  const missingAt = useMemo(() => new Set(missing.flatMap(item => item.ranges.map(range => `${range.page}:${range.from}`))), [missing]);
  const read = readPages ? new Set(readPages) : undefined;
  useEffect(() => {
    if (!focus || !pane.current) return;
    const target = pane.current.querySelector<HTMLElement>(`[data-at="${focus.page}:${focus.from}"]`) ?? pane.current.querySelector<HTMLElement>(`[data-page="${focus.page}"]`);
    if (target) pane.current.scrollTo({ top: Math.max(0, target.offsetTop - pane.current.clientHeight / 3), behavior: 'smooth' });
  }, [focus]);
  // A new object each time, so showing the same lines again scrolls back to them.
  const show = (range: Focus) => setFocus({ ...range });
  const focused = (page: number, line: number) => Boolean(focus && focus.page === page && line >= focus.from && line <= focus.to);

  return <div className="ln-draft">
    <section className="ln-draft-text" aria-label="Organized draft">
      <h3 className="ln-draft-title">Organized draft</h3>
      <ol className="ln-draft-lines">{lines.map((item, index) => item.heading
        ? <li key={index} className="ln-draft-heading">{item.text}</li>
        : <li key={index} data-unverified={item.result && !item.result.verified ? '' : undefined}>
          <span className="ln-draft-line">{item.text}</span>
          <Positions ranges={item.ranges} onFocus={show} />
          {item.result && !item.result.verified ? <span className="ln-draft-problem">{item.result.problems.map(problemLine).join('; ')}</span> : null}
        </li>)}</ol>
      {missing.length ? <div className="ln-draft-missing">
        <p className="text-sm font-medium text-warning">Lines of the original with an amount that no line cites (perhaps left out on purpose; check them):</p>
        <ul>{missing.map(item => <li key={item.item}><Positions ranges={item.ranges} onFocus={show} /><span>{item.text}</span></li>)}</ul>
      </div> : null}
    </section>
    <section className="ln-draft-source" aria-label="Original">
      <h3 className="ln-draft-title">Original</h3>
      <div ref={pane} className="ln-draft-pages" tabIndex={0}>
        {pages.map(page => <div key={page.page} data-page={page.page} className="ln-draft-page" data-unread={read && !read.has(page.page) ? '' : undefined}>
          <p className="ln-draft-page-head">{`Page ${page.page}`}{read && !read.has(page.page) ? <span>{' · not read'}</span> : null}</p>
          <ol>{page.lines.map((line, index) => <li key={index} data-at={`${page.page}:${index + 1}`} data-focus={focused(page.page, index + 1) ? '' : undefined} data-missing={missingAt.has(`${page.page}:${index + 1}`) ? '' : undefined}>
            <span className="ln-draft-number">{index + 1}</span><span>{line}</span>
          </li>)}</ol>
        </div>)}
      </div>
    </section>
  </div>;
}

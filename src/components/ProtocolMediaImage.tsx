"use client";

import Image from "next/image";
import { useState } from "react";

/** Preview failure does not imply the immutable original is missing. */
export function ProtocolMediaImage({ href, label, originalHref, openOriginal = true }: { href: string; label: string; originalHref?: string; openOriginal?: boolean }) {
  const [failedSource, setFailedSource] = useState<string>();
  const [originalSource, setOriginalSource] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const source = originalSource === href && originalHref ? originalHref : href;
  const failed = failedSource === source;
  const retry = () => { setFailedSource(undefined); setOriginalSource(undefined); setAttempt(n => n + 1); };
  if (failed) return <div role="alert" className="document-media-error">
    <span>图片加载失败 / Image unavailable</span>
    <button type="button" data-print-hidden onClick={retry}>重试 / Retry</button>
    <a data-print-hidden href={originalHref || href} target="_blank" rel="noreferrer">查看原图 / Open original</a>
  </div>;
  const picture = <Image key={`${source}:${attempt}`} src={source} alt={label} width={1200} height={800} sizes="(max-width: 760px) 100vw, 760px" unoptimized onError={() => {
    if (source === href && originalHref && originalHref !== href) setOriginalSource(href);
    else setFailedSource(source);
  }} />;
  return openOriginal ? <a className="document-media-original" href={originalHref || href} target="_blank" rel="noreferrer" title="查看原图 / Open original">{picture}</a> : picture;
}

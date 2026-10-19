import type { AnchorHTMLAttributes, ReactNode } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string | { pathname?: string | null; search?: string | null }; prefetch?: boolean | null; replace?: boolean; scroll?: boolean; children?: ReactNode };

/**
 * `next/link` in the offline calculator: links between calculator pages become hash routes; anything else lives on the
 * LabNest server, so it shows as plain text with a note.
 */
export default function Link({ href, children, ...props }: LinkProps) {
  const anchor = Object.fromEntries(Object.entries(props).filter(([key]) => !['prefetch', 'replace', 'scroll'].includes(key))) as AnchorHTMLAttributes<HTMLAnchorElement>;
  const target = typeof href === 'string' ? href : `${href.pathname ?? ''}${href.search ?? ''}`;
  const calculator = target.match(/^\/tools\/calculator(?:\/([^?#]+))?(\?[^#]*)?/);
  if (!calculator) return <span className={anchor.className} title="离线版不含此功能，请在 LabNest 里打开">{children}</span>;
  return <a {...anchor} href={`#/${calculator[1] ?? ''}${calculator[2] ?? ''}`}>{children}</a>;
}

/** Offline navigation is instant: there is never a pending server page. */
export function useLinkStatus() {
  return { pending: false };
}

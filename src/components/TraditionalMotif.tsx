import type { SVGProps } from "react";

export type TraditionalMotifName = "huiwen" | "ruyi-cloud" | "lotus" | "linked-diamond";

export function TraditionalMotif({ motif, ...props }: SVGProps<SVGSVGElement> & { motif: TraditionalMotifName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {motif === "huiwen" ? (
        <path d="M5.5 5.5h13v13h-10v-10h7v7h-4v-4h1.5" />
      ) : motif === "ruyi-cloud" ? (
        <path d="M4.5 14.5c0-2 1.5-3.5 3.4-3.5.6-2.3 2.3-3.8 4.6-3.8 2.7 0 4.7 2 4.7 4.5 1.4.2 2.3 1.2 2.3 2.6 0 1.7-1.3 3-3.2 3H7.2c-1.6 0-2.7-1.1-2.7-2.8Z" />
      ) : motif === "lotus" ? (
        <>
          <path d="M12 18.7c-3.8-2.2-5.5-5.6-4.8-9.4 2.7.5 4.4 2.2 4.8 4.8.4-2.6 2.1-4.3 4.8-4.8.7 3.8-1 7.2-4.8 9.4Z" />
          <path d="M12 14.1c-1.7-2.1-1.7-4.5 0-7 1.7 2.5 1.7 4.9 0 7ZM7.5 18.8h9" />
        </>
      ) : (
        <>
          <path d="m4.5 12 4-4 4 4-4 4-4-4Zm7 0 4-4 4 4-4 4-4-4Z" />
          <path d="m8.5 8 3.5-3.5L15.5 8M8.5 16l3.5 3.5 3.5-3.5" />
        </>
      )}
    </svg>
  );
}

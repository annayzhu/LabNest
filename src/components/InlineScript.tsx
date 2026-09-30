"use client";

/*
 * Pre-paint bootstrap script (Next guide: preventing-flash-before-hydration).
 * Server HTML carries an executable script that runs while the page is parsed. A client render
 * produces an inert text/plain block instead, so if React ever rebuilds the layout on the client
 * it neither re-runs the script nor logs its "Encountered a script tag" development warning.
 * This must stay a Client Component: rendered only on the server it would always be text/javascript.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

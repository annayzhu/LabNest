export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { VisualizationMigration } from "@/components/VisualizationMigration";
import { visualizationStudioUrl } from "@/lib/visualization-link";

export const metadata: Metadata = {
  title: "Visualization Studio · LabNest",
  description: "Configurable, publication-ready scientific visualization workspace.",
};

export default function VisualizationStudioPage() {
  // This page may immediately leave LabNest; avoid starting sidebar prefetches.
  return (
    <main className="min-h-dvh bg-surface">
      <header className="border-b border-hairline px-4 py-2">
        <Link href="/tools" prefetch={false} className="focus-ring inline-flex min-h-11 items-center text-sm text-moss">Back to tools</Link>
      </header>
      <VisualizationMigration url={visualizationStudioUrl(process.env.VISUALIZATION_STUDIO_URL)} />
    </main>
  );
}

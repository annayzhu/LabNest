export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { VisualizationMigration } from "@/components/VisualizationMigration";
import { visualizationStudioUrl } from "@/lib/visualization-link";

export const metadata: Metadata = {
  title: "Visualization Studio · LabNest",
  description: "Configurable, publication-ready scientific visualization workspace.",
};

export default function VisualizationStudioPage() {
  return (
    <AppShell>
      <VisualizationMigration url={visualizationStudioUrl(process.env.VISUALIZATION_STUDIO_URL)} />
    </AppShell>
  );
}

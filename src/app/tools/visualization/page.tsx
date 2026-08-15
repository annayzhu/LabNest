import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { VisualizationStudio } from "@/components/VisualizationStudio";

export const metadata: Metadata = {
  title: "Visualization Studio · LabNest",
  description: "Configurable, publication-ready scientific visualization workspace.",
};

export default function VisualizationStudioPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader identifier="TOOLS / VIS" title="Visualization Studio" />
        <VisualizationStudio />
      </div>
    </AppShell>
  );
}

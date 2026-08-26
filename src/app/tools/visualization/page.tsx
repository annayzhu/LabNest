import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { VisualizationStudio } from "@/components/VisualizationStudio";

export const metadata: Metadata = {
  title: "Visualization Studio · LabNest",
  description: "Configurable, publication-ready scientific visualization workspace.",
};

export default function VisualizationStudioPage() {
  return (
    <AppShell>
      <VisualizationStudio />
    </AppShell>
  );
}

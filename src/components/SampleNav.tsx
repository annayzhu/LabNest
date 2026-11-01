import { Database, Grid3x3, Tags, TestTube2 } from "lucide-react";
import { SectionTabs } from "@/components/SectionTabs";
import { prisma } from "@/lib/db";

const sections = [
  { key: "samples", href: "/samples", label: "Samples", icon: TestTube2 },
  { key: "boxes", href: "/samples/boxes", label: "Boxes", icon: Grid3x3 },
  { key: "types", href: "/samples/types", label: "Types", icon: Tags },
  { key: "bank", href: "/samples/bank", label: "External sample bank", icon: Database },
] as const;

/**
 * The samples pages, one row under the page title, each with how many records it lists; the same tab bar as inventory's.
 * Detail pages show it too, with the page they belong to selected. The sample bank tab shows once a bank is turned on (S20).
 */
export async function SampleNav({ current }: { current: (typeof sections)[number]["key"] }) {
  const [samples, boxes, types, bank, banksOn] = await Promise.all([
    prisma.sample.count(),
    prisma.inventoryLocation.count({ where: { status: "active" } }),
    prisma.scientificSchemaDefinition.count({ where: { objectKind: "sample" } }),
    prisma.sampleBankSearch.count({ where: { test: false } }),
    prisma.sampleBankConnection.count({ where: { enabled: true } }),
  ]);
  const counts = { samples, boxes, types, bank };
  const shown = sections.filter(({ key }) => key !== "bank" || banksOn || current === "bank");
  return <SectionTabs name="Sample sections" current={current} tabs={shown.map((section) => ({ ...section, count: counts[section.key] }))} />;
}

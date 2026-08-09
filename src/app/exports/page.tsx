import { redirect } from "next/navigation";

export default function LegacyExportsPage() {
  redirect("/settings#local-backup");
}

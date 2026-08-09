import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProjectForm } from "@/components/ProjectForm";
import { createProject } from "../actions";

export default function NewProjectPage() {
  return <AppShell><div className="space-y-5"><PageHeader title="New Project" /><ProjectForm action={createProject} /></div></AppShell>;
}

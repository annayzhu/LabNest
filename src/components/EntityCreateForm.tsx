"use client";

import { useActionState, useState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";

const initialState: FormActionState = {};
const entityTypes = ["plasmid", "primer", "oligo", "cell_line", "antibody", "protein", "reagent", "compound", "bacteria", "mixture", "sample", "other"] as const;

export function EntityCreateForm({ action, projects, schemas, initialType = "other", initialMixtureKind, initialProjectId }: {
  action: FormAction;
  projects: Array<{ id: string; name: string }>;
  schemas: Array<{ key: string; label: string; entityType: typeof entityTypes[number] }>;
  initialType?: typeof entityTypes[number];
  initialMixtureKind?: "recipe" | "preparation";
  initialProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialSchema = schemas.find((schema) => schema.entityType === initialType) ?? schemas[0];
  const [type, setType] = useState(initialType);
  const [schemaKey, setSchemaKey] = useState(initialSchema?.key ?? "");
  const [mixtureKind, setMixtureKind] = useState<"recipe" | "preparation">(initialMixtureKind ?? "recipe");
  const [scope, setScope] = useState<"library" | "project">(initialProjectId || initialMixtureKind === "preparation" ? "project" : "library");
  const projectRequired = scope === "project" || (type === "mixture" && mixtureKind === "preparation");
  return <form action={formAction} className="space-y-4"><Card><CardHeader title={type === "mixture" ? "Mixture" : "Entity from schema"} /><CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <label className="md:col-span-2"><span className={formLabelClass}>Name *</span><input required name="name" maxLength={180} className={formInputClass} /></label>
    {type === "mixture" ? <input type="hidden" name="type" value="mixture" /> : <><input type="hidden" name="type" value={type} /><label><span className={formLabelClass}>Scientific schema *</span><select required name="schemaKey" value={schemaKey} onChange={(event) => { const key = event.target.value; setSchemaKey(key); const schema = schemas.find((item) => item.key === key); if (schema) setType(schema.entityType); }} className={formInputClass}>{schemas.map((schema) => <option key={schema.key} value={schema.key}>{schema.label}</option>)}</select></label></>}
    <label><span className={formLabelClass}>Code</span><input name="code" maxLength={80} className={formInputClass} placeholder="Optional user code" /></label>
    {type === "mixture" ? <label><span className={formLabelClass}>Mixture kind *</span><select name="mixtureKind" value={mixtureKind} onChange={(event) => { const value = event.target.value as typeof mixtureKind; setMixtureKind(value); if (value === "preparation") setScope("project"); }} className={formInputClass}><option value="recipe">Recipe</option><option value="preparation">Preparation</option></select></label> : null}
    <label><span className={formLabelClass}>Location *</span><select name="ownershipScope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} disabled={type === "mixture" && mixtureKind === "preparation"} className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select></label>
    <label><span className={formLabelClass}>Project{projectRequired ? " *" : ""}</span><select name="projectId" required={projectRequired} disabled={!projectRequired} defaultValue={initialProjectId ?? ""} className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    <label><span className={formLabelClass}>Status *</span><select name="status" defaultValue="active" className={formInputClass}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
    <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Description</span><textarea name="description" maxLength={5000} className={`${formTextareaClass} min-h-28`} /></label>
  </CardBody></Card><div className="flex items-center justify-end gap-3">{state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}<Button type="submit" variant="primary" size="md" disabled={pending}>{pending ? "Creating…" : "Create Entity"}</Button></div></form>;
}

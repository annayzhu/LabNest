"use client";

import { useActionState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { projectStatusOptions } from "@/lib/status-options";

const initialState: FormActionState = {};

export function ProjectForm({
  action,
  initial = {},
}: {
  action: FormAction;
  initial?: {
    id?: string;
    name?: string;
    description?: string | null;
    status?: string;
    tags?: string[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card>
        <CardHeader title="Project identity" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className={formLabelClass}>Project name</span>
            <input required name="name" defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} />
          </label>
          <StatusRadioGroup
            label="Status"
            name="status"
            options={projectStatusOptions}
            defaultValue={initial.status ?? "active"}
            required
          />
          <label>
            <TagFieldLabel />
            <input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} />
          </label>
          <label className="md:col-span-2">
            <span className={formLabelClass}>Description and scientific objective</span>
            <textarea name="description" defaultValue={initial.description ?? ""} maxLength={10000} className={formTextareaClass} />
          </label>
        </CardBody>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Save Project"}
        </Button>
      </div>
    </form>
  );
}

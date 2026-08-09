import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { projectStatusOptions } from "@/lib/status-options";

export function ProjectForm({
  action,
  initial = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: {
    id?: string;
    name?: string;
    description?: string | null;
    status?: string;
    tags?: string[];
  };
}) {
  return (
    <form action={action} className="space-y-5">
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
      <div className="flex justify-end">
        <button className="focus-ring h-10 rounded-[7px] border border-moss bg-moss px-4 text-sm font-medium text-warm">
          Save Project
        </button>
      </div>
    </form>
  );
}

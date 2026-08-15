"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { AlertCircle, Save, Trash2 } from "lucide-react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import type { FormActionState } from "@/lib/form-actions";

type Option = { readonly value: string; readonly label: string };
type ProjectOption = { readonly id: string; readonly name: string };
type BulkActionState = FormActionState & { success?: string };

type SequenceBatchAction = (_previousState: BulkActionState, formData: FormData) => Promise<BulkActionState>;

export function SequenceCollectionBatchActions({
  selectionGroup,
  targetName,
  typeLabel,
  typeOptions,
  projects,
  action,
}: {
  selectionGroup: string;
  targetName: string;
  typeLabel: string;
  typeOptions: ReadonlyArray<Option>;
  projects: ProjectOption[];
  action: SequenceBatchAction;
}) {
  const initialState: BulkActionState = {};
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const hasSelection = selectedIds.length > 0;

  const refreshSelection = useCallback(() => {
    const ids = [...document.querySelectorAll<HTMLInputElement>("input[data-selection-group]:checked")]
      .filter((input) => input.dataset.selectionGroup === selectionGroup)
      .map((input) => input.value)
      .filter(Boolean);
    setSelectedIds(ids);
  }, [selectionGroup]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.dataset.selectionGroup === selectionGroup) refreshSelection();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [selectionGroup, refreshSelection]);

  return (
    <section className="space-y-2 rounded-[10px] border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-ink">{targetName} batch edit</h2>
        <span className="rounded-full bg-sage-surface px-2.5 py-0.5 text-xs text-moss">已选 {selectedIds.length}</span>
        {pending ? <span className="text-xs text-muted">处理中…</span> : null}
      </div>
      {state.error ? (
        <div className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">
          <p className="flex items-start gap-1"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{state.error}</p>
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-[8px] border border-sage/30 bg-sage-surface px-3 py-2 text-sm text-moss">
          <p>{state.success}</p>
        </div>
      ) : null}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!hasSelection || !window.confirm(`确认删除 ${selectedIds.length} 个 ${targetName}？`)) {
            event.preventDefault();
          }
        }}
        className="space-y-2"
      >
        <input type="hidden" name="intent" value="delete" />
        {selectedIds.map((id) => <input key={`delete-${id}`} type="hidden" name="ids" value={id} />)}
        <button type="submit" disabled={pending || !hasSelection} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-error bg-error px-3 text-xs font-medium text-white disabled:opacity-60">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          批量删除
        </button>
      </form>
      <form action={formAction} className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_1fr_auto] md:items-end" onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_project" />
        {selectedIds.map((id) => <input key={`project-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改项目</span>
          <select name="projectId" defaultValue="" className={`${formInputClass} w-full`}>
            <option value="">共享库</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted md:pb-1">空选项表示移动到共享库</p>
        <button type="submit" disabled={pending || !hasSelection} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-moss bg-moss px-3 text-xs font-medium text-warm disabled:opacity-60">
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用项目修改
        </button>
      </form>
      <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_auto]" onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_description" />
        {selectedIds.map((id) => <input key={`description-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改说明</span>
          <textarea name="description" maxLength={5000} className={`${formTextareaClass} min-h-20`} placeholder="输入新的说明内容（留空表示清空）" />
        </label>
        <button type="submit" disabled={pending || !hasSelection} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-moss bg-moss px-3 text-xs font-medium text-warm disabled:opacity-60 md:self-end">
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用说明修改
        </button>
      </form>
      <form action={formAction} className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end" onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_type" />
        {selectedIds.map((id) => <input key={`type-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改{typeLabel}</span>
          <select name="type" defaultValue="" required className={`${formInputClass} w-full`}>
            <option value="" disabled>选择{typeLabel}</option>
            {typeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending || !hasSelection} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-moss bg-moss px-3 text-xs font-medium text-warm disabled:opacity-60 md:self-end">
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用类型修改
        </button>
      </form>
    </section>
  );
}

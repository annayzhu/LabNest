"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Save, Trash2 } from "lucide-react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { cn } from "@/lib/cn";
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
  typeDisabledIds = [],
  projects,
  action,
  layout = "full",
}: {
  selectionGroup: string;
  targetName: string;
  typeLabel: string;
  typeOptions: ReadonlyArray<Option>;
  typeDisabledIds?: string[];
  projects: ProjectOption[];
  action: SequenceBatchAction;
  layout?: "full" | "sidebar";
}) {
  const initialState: BulkActionState = {};
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dialog = useModalDialog();
  const deleteConfirmedRef = useRef(false);
  const hasSelection = selectedIds.length > 0;
  const typeEditDisabled = selectedIds.some((id) => typeDisabledIds.includes(id));
  const isSidebar = layout === "sidebar";
  const primaryButtonClass = cn(buttonStyles({ variant: "primary", size: "sm", className: "font-medium" }), isSidebar && "w-full");

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
    <section className="space-y-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-ink">{targetName} batch edit</h2>
        <span className="rounded-full bg-sage-surface px-2.5 py-0.5 text-xs text-moss">已选 {selectedIds.length}</span>
        {pending ? <span className="text-xs text-muted">处理中…</span> : null}
      </div>
      {state.error ? (
        <div className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">
          <p className="flex items-start gap-1"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{state.error}</p>
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-[var(--ln-radius-control-lg)] border border-sage/30 bg-sage-surface px-3 py-2 text-sm text-moss">
          <p>{state.success}</p>
        </div>
      ) : null}
      <form
        action={formAction}
        onSubmit={async (event) => {
          if (!hasSelection) { event.preventDefault(); return; }
          if (deleteConfirmedRef.current) { deleteConfirmedRef.current = false; return; }
          event.preventDefault();
          const form = event.currentTarget;
          const confirmed = await dialog.confirm({ title: `确认删除 ${selectedIds.length} 个${targetName}？`, description: "删除后无法撤销，请确认当前选择范围。", confirmLabel: "批量删除", cancelLabel: "取消", tone: "destructive" });
          if (confirmed) { deleteConfirmedRef.current = true; form.requestSubmit(); }
        }}
        className="space-y-2"
      >
        <input type="hidden" name="intent" value="delete" />
        {selectedIds.map((id) => <input key={`delete-${id}`} type="hidden" name="ids" value={id} />)}
        <button type="submit" disabled={pending || !hasSelection} className={cn("focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--ln-radius-control-md)] border border-error bg-error px-3 text-xs font-medium text-white disabled:opacity-60", isSidebar && "w-full")}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          批量删除
        </button>
      </form>
      <form action={formAction} className={cn("grid gap-2", !isSidebar && "md:grid-cols-[minmax(180px,1fr)_1fr_auto] md:items-end")} onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_project" />
        {selectedIds.map((id) => <input key={`project-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改项目</span>
          <select name="projectId" defaultValue="" className={`${formInputClass} w-full`}>
            <option value="">Sequence library</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <p className={cn("text-xs text-muted", !isSidebar && "md:pb-1")}>空选项表示移动到 Sequence library</p>
        <button type="submit" disabled={pending || !hasSelection} className={primaryButtonClass}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用项目修改
        </button>
      </form>
      <form action={formAction} className={cn("grid gap-2", !isSidebar && "md:grid-cols-[1fr_auto]")} onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_description" />
        {selectedIds.map((id) => <input key={`description-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改说明</span>
          <textarea name="description" maxLength={5000} className={`${formTextareaClass} min-h-20`} placeholder="输入新的说明内容（留空表示清空）" />
        </label>
        <button type="submit" disabled={pending || !hasSelection} className={cn(primaryButtonClass, !isSidebar && "md:self-end")}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用说明修改
        </button>
      </form>
      <form action={formAction} className={cn("grid gap-2", !isSidebar && "md:grid-cols-[minmax(220px,1fr)_auto] md:items-end")} onSubmit={(event) => { if (!hasSelection) event.preventDefault(); }}>
        <input type="hidden" name="intent" value="set_type" />
        {selectedIds.map((id) => <input key={`type-${id}`} type="hidden" name="ids" value={id} />)}
        <label className="space-y-1">
          <span className={formLabelClass}>批量修改{typeLabel}</span>
          <select name="type" defaultValue="" required disabled={typeEditDisabled} className={`${formInputClass} w-full`}>
            <option value="" disabled>选择{typeLabel}</option>
            {typeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        {typeEditDisabled ? <p className="text-xs leading-5 text-muted">配对引物与 siRNA 的 DNA/RNA 成员版本不可互转；请新建新的配对条目。</p> : null}
        <button type="submit" disabled={pending || !hasSelection || typeEditDisabled} className={cn(primaryButtonClass, !isSidebar && "md:self-end")}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          应用类型修改
        </button>
      </form>
    </section>
  );
}

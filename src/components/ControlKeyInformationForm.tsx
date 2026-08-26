"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { formLabelClass, formTextareaClass } from "@/components/forms";
import { keyInformationMaxLength, type KeyInformationAction, type KeyInformationFormState } from "@/lib/key-information";

const initialState: KeyInformationFormState = {};

export function ControlKeyInformationForm({
  id,
  initialValue,
  scope,
  action,
}: {
  id: string;
  initialValue?: string | null;
  scope: "project" | "research_plan";
  action: KeyInformationAction;
}) {
  const { locale } = useI18n();
  const [state, formAction, pending] = useActionState(action, initialState);
  const placeholder = scope === "project"
    ? locale === "zh" ? "填写项目范围、关键限制、时间节点或共同决策…" : "Record scope, constraints, milestones, or shared decisions…"
    : locale === "zh" ? "填写关键假设、研究决策、风险或下一步重点…" : "Record critical assumptions, decisions, risks, or next steps…";

  return (
    <form action={formAction} className="border-t border-hairline pt-4">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`key-information-${scope}-${id}`} className={formLabelClass}>
        {locale === "zh" ? "关键信息" : "Key information"}
      </label>
      <textarea
        id={`key-information-${scope}-${id}`}
        name="keyInformation"
        defaultValue={initialValue ?? ""}
        maxLength={keyInformationMaxLength}
        placeholder={placeholder}
        className={`${formTextareaClass} min-h-28 resize-y bg-surface`}
      />
      <div className="mt-2 flex min-h-8 items-center justify-between gap-3">
        <div className="min-w-0 text-xs">
          {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
          {state.saved ? <p role="status" className="text-moss">{locale === "zh" ? "已保存" : "Saved"}</p> : null}
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          {pending ? locale === "zh" ? "保存中…" : "Saving…" : locale === "zh" ? "保存" : "Save"}
        </Button>
      </div>
    </form>
  );
}

import { formLabelClass } from "@/components/forms";
import { tagSeparatorHint } from "@/lib/tags";

export function TagFieldLabel() {
  return (
    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className={formLabelClass}>Tags</span>
      <span className="text-[10px] font-normal normal-case tracking-normal text-disabled">{tagSeparatorHint}</span>
    </span>
  );
}

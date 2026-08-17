import Form from "next/form";
import { ArrowUpDown } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { normalizeResearchPlanSort, researchPlanSortOptions } from "@/lib/research-plan-sorting";

export function ResearchPlanSortControl({ path, value }: { path: string; value?: string }) {
  const sort = normalizeResearchPlanSort(value);
  return (
    <Form action={path} className="flex items-center gap-2">
      <label>
        <span className="sr-only">Sort Research Plans</span>
        <select name="planSort" defaultValue={sort} className="focus-ring h-9 max-w-52 rounded-[7px] border border-hairline bg-surface px-2 text-[13px] text-graphite">
          {researchPlanSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button className={buttonStyles({ size: "sm", className: "bg-surface font-medium text-graphite hover:bg-warm" })}>
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
        Apply
      </button>
    </Form>
  );
}

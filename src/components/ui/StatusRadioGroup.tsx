"use client";

import { formLabelClass } from "@/components/forms";
import { cn } from "@/lib/cn";

export type StatusRadioOption = {
  value: string;
  label: string;
  description?: string;
};

export function StatusRadioGroup({
  label,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  required,
  disabled,
  className,
  optionsClassName,
  density = "default",
}: {
  label: string;
  name?: string;
  options: readonly StatusRadioOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  optionsClassName?: string;
  density?: "default" | "compact";
}) {
  const controlled = value !== undefined;

  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className={density === "compact" ? "text-[10px] font-medium uppercase tracking-[0.05em] text-muted" : formLabelClass}>
        {label}
      </legend>
      <div className={cn(density === "compact" ? "mt-1.5 flex flex-wrap gap-1.5" : "mt-2 flex flex-wrap gap-2", optionsClassName)}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "focus-within:ring-2 focus-within:ring-moss/30 flex cursor-pointer items-start border border-hairline bg-surface text-graphite transition hover:border-border-strong hover:bg-warm",
              density === "compact"
                ? "min-h-8 gap-1.5 rounded-[var(--ln-radius-control-md)] px-2 py-1.5 text-xs"
                : "min-h-10 gap-2 rounded-[var(--ln-radius-control-lg)] px-3 py-2 text-sm",
              disabled && "cursor-not-allowed opacity-55",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              required={required}
              checked={controlled ? value === option.value : undefined}
              defaultChecked={!controlled ? defaultValue === option.value : undefined}
              onChange={() => onValueChange?.(option.value)}
              className={cn("mt-0.5 shrink-0 accent-moss", density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4")}
            />
            <span>
              <span className="block font-medium text-ink">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs leading-4 text-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

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
}) {
  const controlled = value !== undefined;

  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className={formLabelClass}>
        {label}
      </legend>
      <div className={cn("mt-2 flex flex-wrap gap-2", optionsClassName)}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "focus-within:ring-2 focus-within:ring-moss/30 flex min-h-10 cursor-pointer items-start gap-2 rounded-[8px] border border-hairline bg-surface px-3 py-2 text-sm text-graphite transition hover:border-border-strong hover:bg-warm",
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
              className="mt-0.5 h-4 w-4 shrink-0 accent-moss"
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

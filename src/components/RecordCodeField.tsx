import { formInputClass, formLabelClass } from "@/components/forms";

export function RecordCodeField({
  label,
  prefix,
  name,
  minimumDigits,
  placeholder,
  defaultValue,
  existingCode,
  value,
  onValueChange,
}: {
  label: string;
  prefix: string;
  name: string;
  minimumDigits: number;
  placeholder: string;
  defaultValue?: string;
  existingCode?: string | null;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  if (existingCode) {
    return (
      <div>
        <span className={formLabelClass}>{label}</span>
        <div className={`${formInputClass} flex items-center bg-stone/50 font-mono text-xs`}>
          {existingCode}
        </div>
      </div>
    );
  }

  const inputId = `${name}-input`;
  return (
    <div>
      <label htmlFor={inputId} className={formLabelClass}>{label}</label>
      <div className="mt-2 flex h-11 w-full overflow-hidden rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm text-sm text-ink focus-within:border-fog focus-within:ring-[3px] focus-within:ring-info/15">
        <span className="flex shrink-0 items-center border-r border-hairline bg-stone/50 px-3 font-mono font-semibold text-graphite">
          {prefix}
        </span>
        <input
          id={inputId}
          required
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          minLength={minimumDigits}
          pattern={`[0-9]{${minimumDigits},}`}
          placeholder={placeholder}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onChange={(event) => onValueChange?.(event.target.value)}
          aria-label={`${label} suffix after ${prefix}`}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono outline-none placeholder:text-muted/70"
        />
      </div>
    </div>
  );
}

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { formInputClass } from "../forms";
import { cn } from "@/lib/cn";

/** Same native select behavior with consistent arrow inset at every width. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="relative block">
    <select {...props} className={cn(formInputClass, "appearance-none pr-9", className)} />
    <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
  </span>;
}

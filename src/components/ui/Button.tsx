import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-moss text-warm border-moss shadow-paper hover:brightness-95",
  secondary:
    "bg-surface text-ink border-hairline hover:border-border-strong hover:bg-warm shadow-paper",
  ghost: "border-transparent text-graphite hover:bg-sage-surface/55 hover:text-ink",
  destructive:
    "bg-error text-warm border-error shadow-paper hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
  icon: "h-10 w-10 p-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-action bg-action text-white hover:border-action-hover hover:bg-action-hover",
  secondary:
    "border-hairline bg-surface text-graphite hover:border-border-strong hover:bg-warm hover:text-ink",
  ghost: "border-transparent bg-transparent text-graphite hover:bg-stone/75 hover:text-ink",
  destructive:
    "border-error/30 bg-error-surface text-error hover:border-error/45 hover:bg-error-surface/70",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[var(--ln-control-height-sm)] px-[var(--ln-control-padding-x-sm)] text-[length:var(--ln-control-font-size-xs)]",
  md: "h-[var(--ln-control-height-md)] px-[var(--ln-control-padding-x-md)] text-[length:var(--ln-control-font-size-sm)]",
  lg: "h-[var(--ln-control-height-lg)] px-[var(--ln-control-padding-x-lg)] text-[length:var(--ln-control-font-size-lg)]",
  icon: "h-[var(--ln-control-height-md)] w-[var(--ln-control-height-md)] p-0",
};

export function buttonStyles({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--ln-radius-control-md)] border font-medium tracking-[-0.005em] transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0",
    variants[variant],
    sizes[size],
    className,
  );
}

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
  const busy = props["aria-busy"] === true || props["aria-busy"] === "true";
  return (
    <button
      data-ui-button
      data-variant={variant}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {busy ? <span className="ln-button-loading-mark" aria-hidden /> : null}
      {children}
    </button>
  );
}

"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "ink";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
};

const base =
  "group relative inline-flex items-center justify-center gap-2 font-sans font-medium uppercase tracking-[0.12em] text-xs transition-all duration-300 ease-atelier select-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink";

const sizes: Record<Size, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-5",
  lg: "h-14 px-7 text-[0.8125rem]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-bone border border-ink shadow-offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
  secondary:
    "bg-bone text-ink border border-ink shadow-offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
  ghost:
    "bg-transparent text-ink border border-transparent hover:border-ink/20 hover:bg-ink/5",
  ink: "bg-saffron text-ink border border-ink shadow-offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", leading, trailing, block, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], block && "w-full", className)}
      {...rest}
    >
      {leading ? <span className="inline-flex shrink-0">{leading}</span> : null}
      <span className="inline-flex items-center">{children}</span>
      {trailing ? <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">{trailing}</span> : null}
    </button>
  );
});

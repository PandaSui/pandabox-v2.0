"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref
) {
  const inputId = id || rest.name || undefined;
  return (
    <label htmlFor={inputId} className="block group">
      {label ? (
        <span className="font-mono-label text-ink/60 block mb-2">{label}</span>
      ) : null}
      <span
        className={cn(
          "flex items-center h-12 border border-ink/25 bg-bone transition-colors",
          "focus-within:border-ink focus-within:shadow-offset-sm",
          error && "border-signal"
        )}
      >
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex-1 bg-transparent outline-none px-4 text-ink placeholder:text-ink/30 font-sans text-sm",
            className
          )}
          {...rest}
        />
      </span>
      {error ? (
        <span className="block mt-1.5 text-xs text-signal font-mono uppercase tracking-wider">{error}</span>
      ) : hint ? (
        <span className="block mt-1.5 text-xs text-ink/50">{hint}</span>
      ) : null}
    </label>
  );
});

"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@pandasui/ui/lib";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={id}
        className="font-mono-label text-ink/60 block"
      >
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="font-mono text-xs text-poppy">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      {...rest}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-12 w-full border border-ink/25 bg-bone px-3",
        "font-sans text-base placeholder:text-ink/30",
        "focus:border-ink focus:outline-none focus:shadow-offset-sm",
        rest.className,
      )}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      {...rest}
      value={value}
      rows={rows}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "block w-full resize-y border border-ink/25 bg-bone p-3",
        "font-sans text-sm placeholder:text-ink/30",
        "focus:border-ink focus:outline-none focus:shadow-offset-sm",
        rest.className,
      )}
    />
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 items-center border border-ink/25 bg-bone",
        "focus-within:border-ink focus-within:shadow-offset-sm",
      )}
    >
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = e.target.value === "" ? 0 : Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        min={min}
        max={max}
        step={step}
        className="h-full flex-1 bg-transparent px-3 font-mono tabular-nums text-base outline-none"
      />
      {suffix && (
        <span className="pr-3 font-mono-label text-ink/45">{suffix}</span>
      )}
    </div>
  );
}

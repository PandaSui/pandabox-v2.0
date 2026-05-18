import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

/**
 * Shared header for every wizard step. Mirrors the section eyebrows used on
 * the landing (how-it-works, why-sui): accent-ruled mono number, display
 * title, hint paragraph, and an optional inline meta chip on the right.
 */
export function StepHeader({
  n,
  accent = "saffron",
  title,
  body,
  meta,
}: {
  n: number;
  accent?: Accent;
  title: string;
  body?: string;
  meta?: React.ReactNode;
}) {
  const num = String(n).padStart(2, "0");
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-6">
      <div>
        <AccentRule color={accent}>
          <MonoLabel accent={accent} className="text-[10px]">
            Step {num}
          </MonoLabel>
        </AccentRule>
        <h2 className="mt-3 font-display text-3xl leading-[1.05] md:text-4xl">
          {title}
        </h2>
        {body && (
          <p className="mt-3 max-w-prose text-sm text-ink/65 md:text-[15px]">
            {body}
          </p>
        )}
      </div>
      {meta && (
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
          {meta}
        </div>
      )}
    </header>
  );
}

/**
 * Bordered field group with a header band — used to cluster related inputs
 * inside a step (e.g. "Token economics" + reserved-rate row).
 */
export function StepCard({
  title,
  hint,
  children,
  meta,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border border-ink/15 bg-bone",
        className,
      )}
    >
      <header className="flex items-baseline justify-between border-b border-ink/10 px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-ink/40" />
          <MonoLabel className="text-[10px]">{title}</MonoLabel>
        </div>
        {meta && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {meta}
          </span>
        )}
      </header>
      <div className="space-y-5 px-5 py-5">
        {hint && (
          <p className="text-xs text-ink/55 -mt-1">{hint}</p>
        )}
        {children}
      </div>
    </section>
  );
}

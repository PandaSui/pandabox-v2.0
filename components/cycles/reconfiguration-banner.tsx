import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RelativeTime } from "@/components/identity/relative-time";

export function ReconfigurationBanner({
  takesEffectAt,
  summary,
  className,
}: {
  takesEffectAt: number;
  summary: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-y border-sky/60 bg-sky/10",
        className,
      )}
    >
      <div className="container flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MonoLabel accent="sky" className="mt-0.5 shrink-0">
            Reconfiguration queued
          </MonoLabel>
          <p className="text-sm text-ink/80">{summary}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink/50">takes effect</span>
          <RelativeTime value={takesEffectAt} className="text-sky" />
        </div>
      </div>
    </div>
  );
}

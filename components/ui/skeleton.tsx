import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink/5 border border-ink/10",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

export function Empty({
  title = "Nothing here yet",
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="border border-dashed border-ink/25 p-10 text-center">
      <div className="font-display text-xl mb-1">{title}</div>
      {hint ? <div className="text-sm text-ink/55">{hint}</div> : null}
    </div>
  );
}

import { cn } from "@/lib/cn";

export function NoiseLayer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "noise pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    />
  );
}

import { PandaMark } from "@/components/brand/panda-mark";
import { cn } from "@/lib/cn";

export function Wordmark({
  className,
  tone = "auto",
}: {
  className?: string;
  tone?: "auto" | "dark";
}) {
  const label = tone === "dark" ? "text-bone/55" : "text-ink/50";
  const markBorder = tone === "dark" ? "border-bone/15" : "border-ink/10";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 leading-none tracking-[-0.02em]",
        className,
      )}
    >
      <span
        data-nav-mark
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-bone",
          markBorder,
        )}
      >
        <PandaMark className="h-full w-full scale-[1.08]" />
      </span>
      <span className="flex flex-col leading-[1.05]">
        <span className="font-display text-[1.05rem] font-medium tracking-[-0.02em]">
          Pandasui
        </span>
        <span
          className={cn(
            "font-mono-label text-[0.625rem] tracking-[0.24em] uppercase mt-[2px]",
            label,
          )}
        >
          Explorer
        </span>
      </span>
    </span>
  );
}

import { cn } from "@/lib/cn";

type Variant = "top" | "bottom" | "both" | "vertical";

export function Hairline({
  variant = "bottom",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "vertical") {
    return (
      <div
        aria-hidden
        className={cn("h-full w-px bg-ink/15", className)}
      />
    );
  }
  const borders =
    variant === "top"
      ? "border-t"
      : variant === "both"
        ? "border-y"
        : "border-b";
  return (
    <div aria-hidden className={cn(borders, "border-ink/15", className)} />
  );
}

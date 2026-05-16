import { cn } from "@/lib/cn";

export function SuiGlyph({
  size = 12,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("inline-block align-baseline", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M12 2.5 5 11.2a8 8 0 1 0 14 0L12 2.5Z" />
      <path d="M8 12.5c1.6 1.4 2.6 2.7 2.6 4.4 0 1.2-.7 2.1-1.7 2.5" />
      <path d="M16 12.5c-1.6 1.4-2.6 2.7-2.6 4.4 0 1.2.7 2.1 1.7 2.5" />
    </svg>
  );
}

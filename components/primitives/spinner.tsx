import { cn } from "@pandasui/ui/lib";

/**
 * Hairline ring spinner — the project's "I'm working" affordance. Used
 * inside transactional buttons during signing, in skeleton cells as a
 * focal point, and anywhere we want to read "in flight" without breaking
 * the engineered-minimalism palette.
 *
 * - 1.5px stroke, ~270° arc, single full revolution per ~0.85s.
 * - Inherits color from `currentColor` so it picks up the surrounding
 *   text colour (bone on ink-fill buttons, ink/55 on bone surfaces).
 * - Respects `prefers-reduced-motion` via a global rule in globals.css
 *   (the `.spinner` class is bypassed when the user opts out — kept
 *   as a static glyph so the affordance is still legible).
 */
export function Spinner({
  size = 14,
  strokeWidth = 1.5,
  className,
  label = "Loading",
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("spinner", className)}
      role="img"
      aria-label={label}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity="0.2"
      />
      <path
        d="M21 12 A 9 9 0 0 0 12 3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

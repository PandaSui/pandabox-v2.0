import Image from "next/image";
import { cn } from "@pandasui/ui/lib";

/**
 * Brand SUI mark. Renders /public/sui-logo.png at the requested pixel size.
 * Accepts the same `size` + `className` props the prior SVG glyph took so all
 * call sites keep working — `text-*` tints become no-ops (the PNG carries its
 * own color), but `opacity-*` and layout classes still apply.
 */
export function SuiGlyph({
  size = 12,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/sui-logo.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("inline-block align-baseline select-none", className)}
      style={{ width: size, height: size }}
      priority={false}
    />
  );
}

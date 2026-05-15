import { cn } from "@/lib/cn";

export function Sparkline({
  points,
  width = 120,
  height = 32,
  positive,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
}) {
  if (!points.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / Math.max(1, points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = positive === undefined ? "currentColor" : positive ? "#56684B" : "#C47557";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", className)}
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

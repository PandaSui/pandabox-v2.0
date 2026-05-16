import { cn } from "@pandasui/ui/lib";

const ACCENTS = [
  "#B8C45E", // saffron
  "#C47557", // poppy
  "#6E8E5D", // jade
  "#6D8796", // sky
  "#D9C57A", // sun
  "#7E685E", // plum
] as const;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Identicon({
  value,
  size = 32,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const seed = (value || "0x0").toLowerCase();
  const h = hash32(seed);
  const color = ACCENTS[h % ACCENTS.length];

  // Build a 5x5 mirrored pixel grid (3 cols mirrored to 5).
  const cells: boolean[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const idx = y * 3 + x;
      const bit = (hash32(seed + ":" + idx) & 1) === 1;
      cells.push(bit);
    }
  }

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const col = x < 3 ? x : 4 - x;
      if (cells[y * 3 + col]) {
        rects.push(
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />,
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("inline-block align-middle", className)}
      style={{ color }}
    >
      <rect width="5" height="5" fill="#F7F1E3" />
      <g fill="currentColor">{rects}</g>
    </svg>
  );
}

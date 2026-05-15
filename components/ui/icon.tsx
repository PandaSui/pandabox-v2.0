import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (p: IconProps) => ({
  width: p.size ?? 16,
  height: p.size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Arrow = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ArrowDiag = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const Plus = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const Minus = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M5 12h14" /></svg>
);
export const Chevron = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M6 9l6 6 6-6" /></svg>
);
export const Dot = (p: IconProps) => (
  <svg {...base(p)} {...p}><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
);
export const Spark = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></svg>
);
export const Compass = (p: IconProps) => (
  <svg {...base(p)} {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-4 2 2-6 4-2z" /></svg>
);
export const Flame = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M12 3c1 4 5 5 5 10a5 5 0 1 1-10 0c0-3 2-4 2-7 2 1 3 2 3 4 1-2 1-5 0-7z" /></svg>
);
export const Shield = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" /></svg>
);
export const Layers = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" /></svg>
);
export const Grid = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
);
export const Wand = (p: IconProps) => (
  <svg {...base(p)} {...p}><path d="M4 20l10-10M15 5l2 2M12 3l1 3M19 8l3 1M17 12l3 1" /></svg>
);

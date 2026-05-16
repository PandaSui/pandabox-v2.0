import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (p: IconProps) => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

// Deploy — three stacked planks rising
export const GlyphDeploy = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <rect x="4" y="14" width="16" height="3" />
    <rect x="6" y="9.5" width="12" height="3" />
    <rect x="8" y="5" width="8" height="3" />
  </svg>
);

// Receive — arrow into a tray
export const GlyphReceive = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 4v10" />
    <path d="M8 10l4 4 4-4" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

// Reconfigure — three horizontal sliders with knobs
export const GlyphReconfigure = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="2" fill="currentColor" />
    <circle cx="15" cy="12" r="2" fill="currentColor" />
    <circle cx="7" cy="17" r="2" fill="currentColor" />
  </svg>
);

// Gas — fine droplet
export const GlyphGas = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 3c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10z" />
    <path d="M10 14a4 4 0 0 0 2.5 3" />
  </svg>
);

// Object — small isometric cube
export const GlyphObject = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);

// Sponsored — receipt with stub
export const GlyphSponsor = (p: IconProps) => (
  <svg {...base(p)} {...p}>
    <path d="M5 4h14v16l-3-2-3 2-3-2-3 2-2-2V4z" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);

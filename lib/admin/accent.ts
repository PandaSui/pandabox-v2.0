import type { ProtocolAccent } from "./protocols";

/**
 * Static Tailwind class sets per protocol accent. Tailwind's JIT can't see
 * interpolated class names (`bg-${accent}`), so every class a protocol panel
 * or deck card might apply is spelled out here and looked up by key.
 *
 * `onAccentText` is the readable text color when sitting *on* the solid fill:
 * saffron/sun are light (ink reads), jade is dark (bone reads). Never put
 * white on saffron — it fails AA (§5.5).
 */
export type AccentClasses = {
  text: string;
  dot: string;
  soft: string;
  border: string;
  solid: string;
  onAccentText: string;
};

export const ACCENT: Record<ProtocolAccent, AccentClasses> = {
  saffron: {
    text: "text-saffron",
    dot: "bg-saffron",
    soft: "bg-saffron/[0.06]",
    border: "border-saffron/40",
    solid: "bg-saffron",
    onAccentText: "text-ink",
  },
  sun: {
    text: "text-sun",
    dot: "bg-sun",
    soft: "bg-sun/[0.06]",
    border: "border-sun/40",
    solid: "bg-sun",
    onAccentText: "text-ink",
  },
  jade: {
    text: "text-jade",
    dot: "bg-jade",
    soft: "bg-jade/[0.06]",
    border: "border-jade/40",
    solid: "bg-jade",
    onAccentText: "text-bone",
  },
};

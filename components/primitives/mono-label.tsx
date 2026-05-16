import { cn } from "@/lib/cn";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum" | "ink";

const accentText: Record<Accent, string> = {
  saffron: "text-saffron",
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
  sun: "text-sun",
  plum: "text-plum",
  ink: "text-ink/60",
};

export function MonoLabel({
  children,
  accent = "ink",
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return (
    <Tag className={cn("font-mono-label", accentText[accent], className)}>
      {children}
    </Tag>
  );
}

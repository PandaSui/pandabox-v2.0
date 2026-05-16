import { cn } from "@/lib/cn";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const modifier: Record<Accent, string> = {
  saffron: "marker--saffron",
  poppy: "marker--poppy",
  jade: "marker--jade",
  sky: "marker--sky",
  sun: "marker--sun",
  plum: "marker--plum",
};

export function Marker({
  color = "saffron",
  className,
  children,
}: {
  color?: Accent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("marker", modifier[color], className)}>{children}</span>
  );
}

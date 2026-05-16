import { cn } from "@pandasui/ui/lib";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const modifier: Record<Accent, string> = {
  saffron: "",
  poppy: "accent-rule--poppy",
  jade: "accent-rule--jade",
  sky: "accent-rule--sky",
  sun: "accent-rule--sun",
  plum: "accent-rule--plum",
};

export function AccentRule({
  color = "saffron",
  className,
  children,
}: {
  color?: Accent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("accent-rule", modifier[color], "pt-4", className)}>
      {children}
    </div>
  );
}

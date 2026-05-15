import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "bone" | "paper" | "ink";
  inset?: boolean;
  diecut?: boolean;
  children?: ReactNode;
};

export function Card({ tone = "bone", inset, diecut, className, children, ...rest }: CardProps) {
  const tones = {
    bone: "bg-bone text-ink",
    paper: "bg-paper text-ink",
    ink: "bg-ink text-bone",
  };
  return (
    <div
      className={cn(
        "relative border border-ink",
        tones[tone],
        inset && "p-6 md:p-8",
        diecut && "diecut",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono-label text-ink/60", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-display text-2xl md:text-3xl leading-[1.05]", className)}>{children}</h3>;
}

export function CardMeta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-ink/65 leading-relaxed", className)}>{children}</p>;
}

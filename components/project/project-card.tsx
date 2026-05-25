import Image from "next/image";
import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Diecut } from "@/components/primitives/diecut";
import { SuiAmount } from "@/components/identity/sui-amount";
import type { Accent } from "@/types/pandabox";
import type { ProjectDTO } from "@/lib/api/project-dto";

const ACCENT_TEXT: Record<Accent, string> = {
  saffron: "text-saffron",
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
  sun: "text-sun",
  plum: "text-plum",
};

const ACCENT_BG: Record<Accent, string> = {
  saffron: "bg-saffron/15",
  poppy: "bg-poppy/15",
  jade: "bg-jade/15",
  sky: "bg-sky/15",
  sun: "bg-sun/20",
  plum: "bg-plum/15",
};

type Variant = "grid" | "featured";

export function ProjectCard({
  project,
  rank,
  variant = "grid",
  priority = false,
  className,
}: {
  project: ProjectDTO;
  rank?: number;
  variant?: Variant;
  /** Pass on the landing's first featured card for LCP. */
  priority?: boolean;
  className?: string;
}) {
  const aspect = variant === "featured" ? "aspect-[4/3]" : "aspect-[16/10]";
  const titleSize = variant === "featured" ? "text-2xl" : "text-xl";
  const padding = variant === "featured" ? "p-6" : "p-5";

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group relative block bg-bone/40 transition-all duration-200 ease-quartOut",
        "border border-ink/15 hover:-translate-y-0.5 hover:border-ink/40",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-paper", aspect)}>
        <Image
          src={project.coverImage}
          alt={`${project.name} cover`}
          fill
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          priority={priority}
          className="object-cover transition-transform duration-300 ease-quartOut group-hover:scale-[1.02]"
        />
        <div
          aria-hidden
          className={cn("absolute inset-0 opacity-30", ACCENT_BG[project.accent])}
        />
        {rank != null && rank <= 3 && (
          <Diecut
            className={cn(
              "absolute right-3 top-3 bg-bone px-2 py-1 text-ink border border-ink",
            )}
          >
            <span className="font-mono-label">
              Nº {String(rank).padStart(2, "0")}
            </span>
          </Diecut>
        )}
      </div>

      <div className={cn("space-y-2", padding)}>
        <div className="flex items-center justify-between gap-2">
          <MonoLabel
            accent={project.accent}
            className={cn(ACCENT_TEXT[project.accent])}
          >
            {project.category}
          </MonoLabel>
          <span className="font-mono text-[11px] text-ink/50">
            {project.ticker}
          </span>
        </div>

        <h3 className={cn("leading-tight", titleSize)}>{project.name}</h3>
        <p className="line-clamp-2 text-sm text-ink/70">{project.tagline}</p>
      </div>

      <div className="grid grid-cols-2 border-t border-ink/15">
        <Cell label="Raised">
          <SuiAmount
            mist={BigInt(project.raisedMist)}
            compact
            maxFractionDigits={1}
            showGlyph={false}
            className="text-sm"
          />
        </Cell>
        <Cell label="Supporters" border>
          <span className="font-mono tabular-nums text-sm">
            {compactInt(project.supporters)}
          </span>
        </Cell>
      </div>
    </Link>
  );
}

function Cell({
  label,
  children,
  border = false,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", border && "border-l border-ink/15")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function compactInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

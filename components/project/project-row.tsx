import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";
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
  saffron: "bg-saffron/12",
  poppy: "bg-poppy/12",
  jade: "bg-jade/12",
  sky: "bg-sky/12",
  sun: "bg-sun/15",
  plum: "bg-plum/12",
};

export function ProjectRow({
  project,
  right,
  className,
}: {
  project: ProjectDTO;
  /** Optional right-side content (stats column for dashboard rows). */
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/p/${project.id}`}
      className={cn(
        "group flex items-center gap-4 border border-ink/15 bg-bone/40 p-3 transition-all",
        "hover:-translate-y-0.5 hover:border-ink/40",
        className,
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-ink/10 bg-paper">
        <Image
          src={project.coverImage}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
        <div
          aria-hidden
          className={cn("absolute inset-0 opacity-30", ACCENT_BG[project.accent])}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <MonoLabel
            accent={project.accent}
            className={cn("text-[9px]", ACCENT_TEXT[project.accent])}
          >
            {project.category}
          </MonoLabel>
          <span className="font-mono text-[10px] text-ink/40">
            {project.ticker}
          </span>
          <span className="ml-auto font-mono text-[10px] text-ink/40">
            Nº{project.cycleNumber}
          </span>
        </div>
        <h3 className="mt-1 truncate text-base leading-tight">{project.name}</h3>
        <p className="mt-0.5 truncate text-xs text-ink/60">{project.tagline}</p>
      </div>
      <div className="hidden shrink-0 text-right md:block">
        {right ?? (
          <div>
            <MonoLabel className="block text-[9px]">Raised</MonoLabel>
            <div className="mt-0.5">
              <SuiAmount
                mist={BigInt(project.raisedMist)}
                compact
                maxFractionDigits={1}
                showGlyph={false}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

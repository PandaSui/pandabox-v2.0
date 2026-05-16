import Image from "next/image";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { Diecut } from "@/components/primitives/diecut";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { SuiAmount } from "@/components/identity/sui-amount";
import { CycleClock } from "@/components/cycles/cycle-clock";
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

export function ProjectHero({ project }: { project: ProjectDTO }) {
  return (
    <section className="border-b border-ink/15">
      <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col justify-center">
          <MonoLabel
            accent={project.accent}
            className={cn(ACCENT_TEXT[project.accent])}
          >
            {project.category}
          </MonoLabel>

          <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
            {project.name}
          </h1>

          <p className="mt-4 max-w-prose text-lg text-ink/70">
            {project.tagline}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <Diecut className="bg-ink/8 px-2.5 py-1">
              <span className="font-mono text-xs">{project.ticker}</span>
            </Diecut>
            <span className="text-ink/30">·</span>
            <span className="text-xs text-ink/50">held by</span>
            <Address value={project.creator} link />
          </div>

          <div className="mt-8 grid grid-cols-2 border border-ink/15 md:grid-cols-4">
            <StatCell label="Raised" emphasis>
              <Marker color="saffron">
                <SuiAmount
                  mist={BigInt(project.raisedMist)}
                  compact
                  maxFractionDigits={1}
                  showGlyph={false}
                  className="text-xl md:text-2xl"
                />
              </Marker>
            </StatCell>
            <StatCell label="Supporters" border>
              <span className="font-mono tabular-nums text-xl md:text-2xl">
                {project.supporters.toLocaleString()}
              </span>
            </StatCell>
            <StatCell label="Cycle" border>
              <span className="font-mono tabular-nums text-xl md:text-2xl">
                Nº{project.cycleNumber}
              </span>
            </StatCell>
            <StatCell label="Time left" border>
              <CycleClock
                cycleEnd={project.cycleEnd}
                className="text-xl md:text-2xl"
              />
            </StatCell>
          </div>

          <div className="mt-8">
            <a
              href="#pay"
              className="diecut inline-flex bg-ink px-6 py-3 text-bone transition-colors hover:bg-ink-90"
            >
              <span className="font-mono-label">Back this project</span>
            </a>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden border border-ink/15 bg-paper lg:aspect-auto lg:min-h-[420px]">
          <Image
            src={project.coverImage}
            alt={`${project.name} cover`}
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            priority
            className="object-cover"
          />
        </div>
      </Container>
    </section>
  );
}

function StatCell({
  label,
  children,
  border = false,
  emphasis = false,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 md:p-5",
        border && "border-l border-ink/15",
        emphasis && "bg-bone/40",
      )}
    >
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}

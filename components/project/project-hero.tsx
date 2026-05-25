import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { Diecut } from "@/components/primitives/diecut";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
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

export async function ProjectHero({ project }: { project: ProjectDTO }) {
  const t = await getTranslations("project.hero");
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
            <span className="text-xs text-ink/50">{t("heldBy")}</span>
            <Address value={project.creator} link />
          </div>

          <div className="mt-8 grid grid-cols-2 border border-ink/15">
            <StatCell label={t("raised")} emphasis>
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
            <StatCell label={t("supporters")} border>
              <span className="font-mono tabular-nums text-xl md:text-2xl">
                {project.supporters.toLocaleString()}
              </span>
            </StatCell>
          </div>

          <div className="mt-8">
            <a
              href="#pay"
              className={cn(
                "group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 font-medium uppercase tracking-[0.12em] text-[0.8rem]",
                "bg-ink text-bone",
                "transition-all duration-300 ease-atelier",
                "hover:-translate-y-[1px] hover:bg-ink-90",
                "active:translate-y-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
              )}
            >
              <span>{t("backThis")}</span>
              <ArrowDiag
                size={14}
                className="transition-transform duration-300 group-hover:translate-x-[2px]"
              />
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

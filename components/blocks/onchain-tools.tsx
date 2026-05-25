import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RevealOnView } from "@/components/motion";
import { ToolTile, hydrateTools, type ToolMessages } from "@/components/tools";

const TILE_CTA_BASE = cn(
  "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-bone px-6",
  "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink",
  "shadow-offset-sm transition-all duration-300 ease-atelier",
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
);

/**
 * Landing-page section that introduces the tools surface. Reads the same
 * registry as `/tools`, but with the compact `ToolTile` so three tiles fit
 * side-by-side. The third tile is a placeholder card teasing future tools —
 * gives the row balance and lets us add new tools without re-flowing the
 * layout.
 */
export async function OnchainTools() {
  const t = await getTranslations("home.tools");
  const tToolNames = await getTranslations("tools.items");
  const tShared = await getTranslations("tools.shared");

  const messages: ToolMessages = {
    airdrop: {
      name: tToolNames("airdrop.name"),
      tagline: tToolNames("airdrop.tagline"),
      description: tToolNames("airdrop.description"),
      capabilities: [
        tToolNames("airdrop.cap1"),
        tToolNames("airdrop.cap2"),
        tToolNames("airdrop.cap3"),
      ],
    },
    redeem: {
      name: tToolNames("redeem.name"),
      tagline: tToolNames("redeem.tagline"),
      description: tToolNames("redeem.description"),
      capabilities: [
        tToolNames("redeem.cap1"),
        tToolNames("redeem.cap2"),
        tToolNames("redeem.cap3"),
      ],
    },
  };

  const tools = hydrateTools(messages);

  return (
    <section className="relative border-t border-ink/15">
      <Container className="py-20 lg:py-28">
        {/* Eyebrow + heading + side meta */}
        <div className="mb-12 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <AccentRule color="sun">
              <MonoLabel>{t("eyebrow")}</MonoLabel>
            </AccentRule>
            <h2 className="mt-3 text-balance text-3xl leading-[1.05] md:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-prose text-base text-ink/65">
              {t("subtitle")}
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5 md:gap-y-2">
            <li className="inline-flex items-center gap-1.5">
              <span className="block h-1 w-1 rounded-full bg-sun" />
              {t("counterShipping", { count: tools.length })}
            </li>
            <li className="text-ink/20">·</li>
            <li>{t("counterMore")}</li>
          </ul>
        </div>

        {/* 3-up grid — tiles for shipping tools + a "future" teaser */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
          {tools.map((tool, i) => (
            <RevealOnView key={tool.slug} delayMs={i * 80}>
              <ToolTile
                tool={tool}
                labels={{
                  available: tShared("statusAvailable"),
                  soon: tShared("statusSoon"),
                }}
              />
            </RevealOnView>
          ))}
          <RevealOnView delayMs={tools.length * 80}>
            <FutureTile
              eyebrow={t("futureEyebrow")}
              title={t("futureTitle")}
              body={t("futureBody")}
            />
          </RevealOnView>
        </div>

        {/* CTA row */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/tools"
            className={cn(
              "group relative inline-flex h-12 items-center justify-center gap-2 border border-ink bg-ink px-6 text-bone",
              "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
              "shadow-offset-sm transition-all duration-300 ease-atelier",
              "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
            )}
          >
            <span>{t("ctaPrimary")}</span>
            <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
              <ArrowDiag size={12} />
            </span>
          </Link>
          <Link href="/docs" className={TILE_CTA_BASE}>
            <span>{t("ctaSecondary")}</span>
            <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
              <ArrowDiag size={12} />
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}

/**
 * Quiet placeholder tile — same chrome as a real tool tile so the row reads
 * cleanly, but lets the user know more tools are on the way without
 * pretending one exists yet.
 */
function FutureTile({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border border-dashed border-ink/35 bg-bone",
        "transition-colors duration-300 ease-atelier hover:border-ink/60",
      )}
    >
      <div className="relative flex flex-1 flex-col gap-5 px-6 py-7">
        <span className="inline-flex h-11 w-11 items-center justify-center border border-ink/25">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <line x1="9" y1="3" x2="9" y2="15" stroke="#161310" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="3" y1="9" x2="15" y2="9" stroke="#161310" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {eyebrow}
          </span>
          <h3 className="mt-1.5 font-display text-[1.5rem] leading-[1.05]">
            {title}
          </h3>
          <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-ink/55">
            {body}
          </p>
        </div>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { CoinType } from "@/components/identity/coin-type";
import { ProjectActionRail } from "@/components/project/project-action-rail";
import { ActivityFeed } from "@/components/project/activity-feed";
import { CoverFrame } from "@/components/project/cover-frame";
import { OnchainRecord } from "@/components/project/onchain-record";
import { PriceChart } from "@/components/project/price-chart";
import { SharePill } from "@/components/project/share-pill";
import { DetailFundingMeter } from "@/components/project/detail-funding-meter";
import { getOnchainProject, type HydratedProject } from "@/lib/projects";
import { getProjectActivity, type ActivityItem } from "@/lib/activity";
import { PROJECT_COIN_DECIMALS, UnsoldAction } from "@/lib/contracts/pandabox";
import { hasValidParams } from "@/lib/project-health";
import type { Accent } from "@/types/pandabox";

const CATEGORY_ACCENT: Record<string, Accent> = {
  art: "saffron",
  music: "saffron",
  meme: "saffron",
  infra: "poppy",
  rwa: "sun",
  dao: "jade",
  social: "jade",
  research: "sky",
  gaming: "plum",
};

const CATEGORY_PILL: Record<Accent, string> = {
  saffron: "bg-saffron/15 text-ink",
  poppy: "bg-poppy/15 text-ink",
  jade: "bg-jade/15 text-ink",
  sky: "bg-sky/15 text-ink",
  sun: "bg-sun/20 text-ink",
  plum: "bg-plum/15 text-ink",
};

const CATEGORY_DOT: Record<Accent, string> = {
  saffron: "bg-saffron",
  poppy: "bg-poppy",
  jade: "bg-jade",
  sky: "bg-sky",
  sun: "bg-sun",
  plum: "bg-plum",
};

type Props = {
  params: Promise<{ projectId: string }>;
};

export const revalidate = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getOnchainProject(projectId);
  if (!project) return { title: "Project not found" };

  const tkr = ticker(project);
  const title = `${project.name} — ${tkr}`;
  const description =
    project.details?.tagline ??
    `${project.name} (${tkr}) — on-chain funding on Sui, powered by Pandabox.`;
  const url = `/projects/${project.id}`;

  // Note: og:image + twitter:image come from `opengraph-image.tsx` colocated
  // in this route — Next wires both automatically. Don't add `images` here or
  // it'll override the dynamic generator with the static IPFS URL.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const [project, activity] = await Promise.all([
    getOnchainProject(projectId),
    getProjectActivity(projectId, 25),
  ]);
  if (!project) notFound();

  const tkr = ticker(project);
  const ended = project.endTimeMs > 0 && Date.now() > project.endTimeMs;
  const live = project.status === "live" && !ended;
  const validParams = hasValidParams(project);

  // Sale numbers in display units. The Move contract uses
  // `tokens_raw = mist * base_rate`, so to invert (raw tokens → mist) we
  // just divide by base_rate.
  const safeBaseRate = BigInt(project.baseRate || 1);
  const raisedMist = project.sold / safeBaseRate;
  const targetMist = project.fundingAllocation / safeBaseRate;
  const pct =
    project.fundingAllocation > 0n
      ? Math.min(
          100,
          Math.max(
            0,
            Number((project.sold * 10_000n) / project.fundingAllocation) / 100,
          ),
        )
      : 0;

  const category = project.details?.category ?? "project";
  const categoryAccent = CATEGORY_ACCENT[category.toLowerCase()] ?? "saffron";
  const tagline = project.details?.tagline ?? "";
  const socials = project.details?.socials ?? {};

  return (
    <>
      <Nav showPulse />
      <main id="main">
        <Container className="pt-6">
          <Link
            href="/explore"
            className="group inline-flex items-center gap-1.5 font-mono-label text-[10px] text-ink/55 transition-colors hover:text-ink"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="transition-transform group-hover:-translate-x-0.5"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            back to explore
          </Link>
        </Container>

        {!validParams && (
          <div className="border-b border-poppy/30 bg-poppy/10">
            <Container className="flex flex-wrap items-center gap-3 py-3">
              <span className="inline-flex items-center gap-1.5 border border-poppy/60 bg-poppy/15 px-2 py-1 font-mono-label text-[10px] text-poppy">
                <span
                  aria-hidden
                  className="block h-1.5 w-1.5 rounded-full bg-poppy"
                />
                Legacy · bad params
              </span>
              <p className="text-sm text-ink/70">
                This project was deployed before the wizard applied 9-decimal
                scaling to <code className="font-mono">base_rate</code>. The
                rate, target, and raised numbers below are off — don't trust
                them or back this sale.
              </p>
            </Container>
          </div>
        )}

        {/* ─── Hero: identity left, cover right ─── */}
        <section className="border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-14">
            {/* Left — identity, progress, supporters, spec line */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em]",
                    CATEGORY_PILL[categoryAccent],
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block h-1.5 w-1.5 rounded-full",
                      CATEGORY_DOT[categoryAccent],
                    )}
                  />
                  {category}
                </span>
                <SharePill projectName={project.name} ticker={tkr} />
              </div>

              <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
                {project.name}
              </h1>

              {tagline && (
                <p className="mt-4 max-w-prose text-lg text-ink/70">
                  {tagline}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="inline-flex items-center border border-ink bg-bone px-2.5 py-1 font-mono text-xs">
                  {tkr}
                </span>
                <span className="text-ink/30">·</span>
                <span className="text-xs text-ink/50">Creator</span>
                <Address value={project.creator} link />
                {project.tokenType && (
                  <>
                    <span className="text-ink/30">·</span>
                    <span className="text-xs text-ink/50">CA</span>
                    <CoinType value={project.tokenType} link />
                  </>
                )}
                {project.verified && (
                  <>
                    <span className="text-ink/30">·</span>
                    <span className="inline-flex items-center gap-1 font-mono-label text-[10px] text-jade">
                      <span className="block h-1.5 w-1.5 rounded-full bg-jade" />
                      Verified
                    </span>
                  </>
                )}
              </div>

              {/* Progress meter */}
              <div className="mt-7">
                <DetailFundingMeter
                  pct={pct}
                  live={live}
                  raisedLabel={<>{formatSui(raisedMist)} SUI</>}
                  targetLabel={<>{formatSui(targetMist)} SUI</>}
                />
              </div>

              {/* Supporter strip — social proof, even when empty */}
              <SupporterStrip activity={activity} />

              {/* 3-cell stat strip — the three items that change the click decision */}
              <div className="mt-6 grid grid-cols-3 border border-ink/15">
                <StatCell
                  label="Status"
                  value={
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        live
                          ? "text-jade"
                          : ended
                            ? "text-poppy"
                            : "text-ink/55",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "block h-1.5 w-1.5 rounded-full",
                          live ? "bg-jade" : ended ? "bg-poppy" : "bg-ink/35",
                        )}
                        style={
                          live
                            ? {
                                animation:
                                  "stat-live-dot 1.4s ease-in-out infinite",
                              }
                            : undefined
                        }
                      />
                      {live ? "Live" : ended ? "Ended" : "Closed"}
                    </span>
                  }
                />
                <StatCell
                  label={
                    live
                      ? project.endTimeMs > 0
                        ? "Ends in"
                        : "Cap"
                      : ended
                        ? "Ended"
                        : "Sale"
                  }
                  value={
                    live ? (
                      project.endTimeMs > 0 ? (
                        <Countdown endMs={project.endTimeMs} />
                      ) : (
                        <span className="text-sm text-ink/60">no cap</span>
                      )
                    ) : (
                      <span className="text-sm text-ink/60">
                        {ended ? "finished" : "closed"}
                      </span>
                    )
                  }
                  border
                />
                <StatCell
                  label="Rate"
                  value={
                    <span className="whitespace-nowrap">
                      {formatToken(BigInt(project.baseRate ?? 0), 0)}
                      <span className="text-ink/45">/SUI</span>
                    </span>
                  }
                  border
                />
              </div>

              {/* Tertiary spec line — supply + unsold action + treasury balance */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                <span>
                  max supply{" "}
                  <span className="text-ink/70">
                    {formatToken(
                      project.fundingAllocation,
                      PROJECT_COIN_DECIMALS,
                    )}{" "}
                    {tkr}
                  </span>
                </span>
                <span className="text-ink/20">·</span>
                <span>
                  unsold{" "}
                  <span className="text-ink/70">
                    {project.unsoldAction === UnsoldAction.TransferToCreator
                      ? "→ creator"
                      : "burn"}
                  </span>
                </span>
                <span className="text-ink/20">·</span>
                <span>
                  remaining{" "}
                  <span className="text-ink/70">
                    {formatToken(
                      project.fundingAllocation - project.sold > 0n
                        ? project.fundingAllocation - project.sold
                        : 0n,
                      PROJECT_COIN_DECIMALS,
                    )}{" "}
                    {tkr}
                  </span>
                </span>
                <span className="text-ink/20">·</span>
                <span>
                  treasury{" "}
                  <span className="text-ink/70">
                    {formatSui(project.suiBalance)} SUI
                  </span>
                </span>
              </div>
            </div>

            {/* Right — cover image, framed as a gallery print */}
            <CoverFrame
              src={project.iconUrl}
              name={project.name}
              ticker={tkr}
              status={live ? "live" : ended ? "ended" : "closed"}
              projectId={project.id}
              createdAtMs={project.createdAtMs}
              priority
              className="lg:min-h-[360px]"
            />
          </Container>
        </section>

        {/* ─── Price chart — placeholder until the creator seeds a Cetus pool ─── */}
        <PriceChart project={project} />

        {/* ─── Body: about + activity (left), pay rail (right, sticky) ─── */}
        <section>
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[7fr_5fr]">
            <div className="min-w-0 space-y-8">
              <AboutTab project={project} />
              <ActivityFeed items={activity} ticker={tkr} />
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProjectActionRail project={project} />
            </div>
          </Container>
        </section>

        {/* ─── On-chain record · spec sheet ─── */}
        <section className="border-t border-ink/15 py-10 md:py-12">
          <OnchainRecord
            projectId={project.id}
            tokenType={project.tokenType}
            createdAtMs={project.createdAtMs}
            socials={socials}
          />
        </section>

        <Footer />
      </main>
    </>
  );
}

function StatCell({
  label,
  value,
  border = false,
}: {
  label: string;
  value: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", border && "border-l border-ink/15")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1.5 font-mono tabular-nums text-base text-ink">
        {value}
      </div>
    </div>
  );
}

function SupporterStrip({ activity }: { activity: ActivityItem[] }) {
  const contributions = activity.filter((a) => a.kind === "contribute");
  const count = contributions.length;
  const last = contributions[0];

  if (count === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-ink/55">
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full bg-ink/25"
        />
        <span className="lowercase tracking-[0.04em]">
          be the first to back this project
        </span>
      </div>
    );
  }

  const sinceMs = Date.now() - last.timestampMs;
  const rel =
    sinceMs < 60_000
      ? "just now"
      : sinceMs < 3_600_000
        ? `${Math.floor(sinceMs / 60_000)}m ago`
        : sinceMs < 86_400_000
          ? `${Math.floor(sinceMs / 3_600_000)}h ago`
          : `${Math.floor(sinceMs / 86_400_000)}d ago`;

  return (
    <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-ink/55">
      <span
        aria-hidden
        className="block h-1.5 w-1.5 rounded-full bg-jade"
        style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
      />
      <span className="lowercase">
        {count} {count === 1 ? "supporter" : "supporters"}
      </span>
      <span aria-hidden className="text-ink/20">
        ·
      </span>
      <span className="lowercase">last by</span>
      <span className="font-mono tabular-nums text-ink/70">
        {shortAddr(last.actor)}
      </span>
      <span aria-hidden className="text-ink/20">
        ·
      </span>
      <span className="lowercase">{rel}</span>
    </div>
  );
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function AboutTab({ project }: { project: HydratedProject }) {
  const description = project.description?.trim();
  return (
    <article className="border border-ink/15 bg-bone shadow-offset-sm">
      <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
        <MonoLabel className="text-[10px]">About</MonoLabel>
        {project.descriptionBlobId && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            ipfs · {shortCid(project.descriptionBlobId)}
          </span>
        )}
      </header>
      <div className="px-5 py-6 md:px-6 md:py-7">
        {description ? (
          <div className="prose-pandabox max-w-prose space-y-4 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink/80">
            {description}
          </div>
        ) : (
          <p className="text-sm text-ink/55">
            No description pinned yet — the creator can publish one any time.
            See the pay panel for sale mechanics.
          </p>
        )}
      </div>
    </article>
  );
}

function Countdown({ endMs }: { endMs: number }) {
  const ms = Math.max(0, endMs - Date.now());
  if (ms === 0) return <span className="text-poppy">ended</span>;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return <span>{days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`}</span>;
}

function ticker(p: HydratedProject): string {
  return (
    p.details?.ticker?.trim() || lastSegment(p.tokenType).toUpperCase() || "TOK"
  );
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function shortCid(cid: string): string {
  if (cid.length <= 14) return cid;
  return `${cid.slice(0, 8)}…${cid.slice(-4)}`;
}

function formatSui(mist: bigint): string {
  return formatToken(mist, 9);
}

function formatToken(raw: bigint, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}

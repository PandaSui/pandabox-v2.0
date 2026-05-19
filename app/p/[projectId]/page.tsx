import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { Address } from "@/components/identity/address";
import { ProjectActionRail } from "@/components/project/project-action-rail";
import { ActivityFeed } from "@/components/project/activity-feed";
import { getOnchainProject, type HydratedProject } from "@/lib/projects";
import { getProjectActivity } from "@/lib/activity";
import { explorerUrl } from "@/lib/sui";
import { PROJECT_COIN_DECIMALS, UnsoldAction } from "@/lib/contracts/pandabox";
import { hasValidParams } from "@/lib/project-health";

type Props = {
  params: Promise<{ projectId: string }>;
};

export const revalidate = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getOnchainProject(projectId);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — ${ticker(project)}`,
    description: project.details?.tagline ?? project.name,
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

  // Sale numbers in display units. base_rate is scaled to 9 decimals, so to
  // invert `tokens_raw = amountMist * base_rate / 1e9` we multiply by 1e9
  // before dividing — otherwise everything renders as 0.0000 SUI.
  const safeBaseRate = BigInt(project.baseRate || 1);
  const MIST_PER_SUI = 1_000_000_000n;
  const raisedMist = (project.sold * MIST_PER_SUI) / safeBaseRate;
  const targetMist = (project.fundingAllocation * MIST_PER_SUI) / safeBaseRate;
  const remaining = project.fundingAllocation - project.sold;
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

        {/* ─── Hero ─── */}
        <section className="border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-16">
            <div className="flex flex-col justify-center">
              <MonoLabel className="uppercase tracking-[0.18em]">
                {category}
              </MonoLabel>

              <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
                {project.name}
              </h1>

              {tagline && (
                <p className="mt-4 max-w-prose text-lg text-ink/70">
                  {tagline}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center border border-ink bg-bone px-2.5 py-1 font-mono text-xs">
                  {tkr}
                </span>
                <span className="text-ink/30">·</span>
                <span className="text-xs text-ink/50">creator</span>
                <Address value={project.creator} link />
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
                <div className="flex items-baseline justify-between">
                  <MonoLabel className="text-[10px]">Raised</MonoLabel>
                  <span className="font-mono tabular-nums text-sm text-ink">
                    {pct.toFixed(2)}
                    <span className="text-ink/45">%</span>
                  </span>
                </div>
                <div className="relative mt-2 h-[5px] overflow-hidden bg-ink/10">
                  <div
                    className="absolute inset-y-0 left-0 bg-saffron transition-[width] duration-500 ease-atelier"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-ink/60">
                  <span>
                    <Marker color="saffron">
                      <span className="text-ink">
                        {formatSui(raisedMist)} SUI
                      </span>
                    </Marker>
                  </span>
                  <span>
                    of {formatSui(targetMist)} SUI{" "}
                    <span className="text-ink/40">target</span>
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="mt-7 grid grid-cols-2 border border-ink/15 md:grid-cols-4">
                <StatCell
                  label="Rate"
                  value={`${formatToken(BigInt(project.baseRate ?? 0), PROJECT_COIN_DECIMALS)} ${tkr}/SUI`}
                />
                <StatCell
                  label="Allocation"
                  value={`${formatToken(project.fundingAllocation, PROJECT_COIN_DECIMALS)} ${tkr}`}
                  border
                />
                <StatCell
                  label={ended ? "Ended" : project.endTimeMs > 0 ? "Ends" : "Cap"}
                  value={
                    project.endTimeMs > 0 ? (
                      <Countdown endMs={project.endTimeMs} />
                    ) : (
                      <span className="text-sm text-ink/60">no time cap</span>
                    )
                  }
                  border
                />
                <StatCell
                  label="Status"
                  value={
                    <span
                      className={
                        live ? "text-jade" : ended ? "text-poppy" : "text-ink/55"
                      }
                    >
                      {live ? "Live" : ended ? "Ended" : "Closed"}
                    </span>
                  }
                  border
                />
              </div>

              {/* Spec strip */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
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
                      remaining > 0n ? remaining : 0n,
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

            {/* Icon panel */}
            <div className="relative aspect-square overflow-hidden border border-ink/15 bg-paper lg:aspect-auto lg:min-h-[360px]">
              {project.iconUrl ? (
                <Image
                  src={project.iconUrl}
                  alt={`${project.name} icon`}
                  fill
                  sizes="(min-width:1024px) 40vw, 100vw"
                  priority
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-9xl text-ink/15">
                    {(project.name?.[0] ?? "P").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </Container>
        </section>

        {/* ─── Body: about + action rail ─── */}
        <section>
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[7fr_5fr]">
            <div className="min-w-0 space-y-8">
              <AboutTab project={project} ticker={tkr} />
              <ActivityFeed items={activity} ticker={tkr} />
            </div>
            <ProjectActionRail project={project} />
          </Container>
        </section>

        {/* ─── Metadata footer ─── */}
        <section className="border-t border-ink/15">
          <Container className="grid grid-cols-1 gap-8 py-10 md:grid-cols-2 lg:grid-cols-4">
            <MetaBlock
              label="Project object"
              value={
                <a
                  href={explorerUrl("object", project.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-[11px] text-ink/80 hover:text-ink"
                >
                  {shortMid(project.id)}
                </a>
              }
            />
            <MetaBlock
              label="Coin type"
              value={
                <span className="break-all font-mono text-[11px] text-ink/80">
                  {project.tokenType || "—"}
                </span>
              }
            />
            <MetaBlock
              label="Deployed"
              value={
                <span className="font-mono text-[12px] text-ink/80">
                  {project.createdAtMs
                    ? new Date(project.createdAtMs).toISOString().slice(0, 16) +
                      "Z"
                    : "—"}
                </span>
              }
            />
            <MetaBlock
              label="Links"
              value={
                <ul className="space-y-1 text-[12px]">
                  {socials.website && (
                    <li>
                      <a
                        href={ensureHttp(socials.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink/70 hover:text-ink"
                      >
                        {socials.website}
                      </a>
                    </li>
                  )}
                  {socials.twitter && (
                    <li>
                      <a
                        href={`https://x.com/${socials.twitter.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink/70 hover:text-ink"
                      >
                        @{socials.twitter.replace(/^@/, "")}
                      </a>
                    </li>
                  )}
                  {socials.discord && (
                    <li>
                      <a
                        href={socials.discord}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink/70 hover:text-ink"
                      >
                        Discord
                      </a>
                    </li>
                  )}
                  {project.sourceCodeBlobId && (
                    <li>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${project.sourceCodeBlobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink/70 hover:text-ink"
                      >
                        Source · IPFS
                      </a>
                    </li>
                  )}
                  {!socials.website &&
                    !socials.twitter &&
                    !socials.discord &&
                    !project.sourceCodeBlobId && (
                      <li className="text-ink/40">none</li>
                    )}
                </ul>
              }
            />
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}

function MetaBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-2">{value}</div>
    </div>
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
    <div className={"p-4 md:p-5" + (border ? " border-l border-ink/15" : "")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-2 font-mono tabular-nums text-lg md:text-xl">
        {value}
      </div>
    </div>
  );
}

function AboutTab({
  project,
  ticker,
}: {
  project: HydratedProject;
  ticker: string;
}) {
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
            No description pinned yet. The creator can publish one any time via{" "}
            <code className="font-mono text-[12px]">
              project::update_metadata
            </code>
            .
          </p>
        )}
        <hr className="my-6 border-ink/10" />
        <p className="font-mono text-[11px] leading-relaxed text-ink/55">
          Supporters receive{" "}
          {formatToken(BigInt(project.baseRate ?? 0), PROJECT_COIN_DECIMALS)}{" "}
          {ticker} per 1 SUI contributed,
          up to a total of{" "}
          {formatToken(project.fundingAllocation, PROJECT_COIN_DECIMALS)}{" "}
          {ticker}. After the sale closes — by time, sellout, or admin action
          — anyone can finalize and claimers burn their{" "}
          <code className="font-mono">ContributionReceipt&lt;T&gt;</code> for
          their share of {ticker}.
        </p>
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
  return (
    <span>
      {days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`}
    </span>
  );
}

function ticker(p: HydratedProject): string {
  return (
    p.details?.ticker?.trim() ||
    lastSegment(p.tokenType).toUpperCase() ||
    "TOK"
  );
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function shortCid(cid: string): string {
  if (cid.length <= 14) return cid;
  return `${cid.slice(0, 8)}…${cid.slice(-4)}`;
}

function ensureHttp(s: string): string {
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
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

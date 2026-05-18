import Link from "next/link";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { RevealOnView } from "@/components/motion";
import { OnchainProjectCard } from "@/components/project/onchain-project-card";
import { getOnchainProjects } from "@/lib/projects";

const RANK_ACCENT = ["saffron", "poppy", "jade"] as const;

export async function FeaturedProjects() {
  const all = await getOnchainProjects();
  // Rank by absolute SUI raised (sold / base_rate), then by recency.
  const ranked = [...all].sort((a, b) => {
    const ar = a.baseRate ? Number(a.sold / BigInt(a.baseRate)) : 0;
    const br = b.baseRate ? Number(b.sold / BigInt(b.baseRate)) : 0;
    if (br !== ar) return br - ar;
    return b.createdAtMs - a.createdAtMs;
  });
  const top = ranked.slice(0, 3);

  const totalRaisedMist = top.reduce(
    (acc, p) => acc + (p.baseRate ? p.sold / BigInt(p.baseRate) : 0n),
    0n,
  );

  return (
    <section className="relative border-t border-ink/15 bg-paper/40">
      <Container className="py-20 lg:py-24">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <AccentRule color="saffron" className="mb-3">
              <MonoLabel>Featured</MonoLabel>
            </AccentRule>
            <h2 className="text-3xl md:text-4xl">Funded right now</h2>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
            <span className="inline-flex items-baseline gap-2">
              <span className="text-ink/40">on-chain</span>
              <span className="font-mono tabular-nums text-ink">
                {all.length.toString().padStart(2, "0")}
              </span>
              <span className="text-ink/40">projects</span>
            </span>
            <span className="text-ink/20">·</span>
            <span className="inline-flex items-baseline gap-2">
              <SuiGlyph size={11} className="text-ink/55" />
              <span className="font-mono tabular-nums text-ink">
                {formatSuiFromMist(totalRaisedMist)}
              </span>
              <span className="text-ink/40">raised across top 3</span>
            </span>
          </div>
        </header>

        {top.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {top.map((p, i) => (
              <RevealOnView key={p.id} delayMs={i * 90} className="block">
                <OnchainProjectCard
                  project={p}
                  rank={i + 1}
                  accent={RANK_ACCENT[i] ?? "plum"}
                  priority={i === 0}
                />
              </RevealOnView>
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Link
            href="/explore"
            className="font-mono-label text-ink/70 hover:text-ink"
          >
            Explore all projects →
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/35">
            data: sui mainnet · revalidates 60s
          </span>
        </div>
      </Container>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="frame mt-2 p-12 text-center">
      <MonoLabel className="text-[10px]">No projects</MonoLabel>
      <p className="mt-3 font-display text-xl text-ink/70">
        Listening for the first project on-chain.
      </p>
      <p className="mt-2 font-mono text-[11px] text-ink/45">
        ProjectCreated events from{" "}
        <code className="text-ink/65">pandabox::project</code> will show up here.
      </p>
    </div>
  );
}

function formatSuiFromMist(mist: bigint): string {
  const n = Number(mist) / 1e9;
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

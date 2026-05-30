import {
  AccentRule,
  Container,
  Diecut,
  Frame,
  Hairline,
  Marker,
  MonoLabel,
  NoiseLayer,
} from "@/components/primitives";
import {
  Address,
  Identicon,
  RelativeTime,
  SuiAmount,
  TokenAmount,
  TxHash,
} from "@/components/identity";
import {
  getGlobalStats,
  getHolders,
  getRecentPaymentsGlobal,
  listProjects,
} from "@/lib/indexer";
import { TreasuryPulse } from "@/components/pulse";

const accents = ["saffron", "poppy", "jade", "sky", "sun", "plum"] as const;

const SAMPLE_ADDRS = [
  "0xc9523f683256502be15ec4979098d510f67b6d3f0df02eebf124515014433270",
  "0xa5fd521610eaba7a65601f79fe5b898a7eef83f94cf2019900df6c512df5e5c1",
  "0x12b843d5322953a53c689975664a22e9ba5db52876a7d89c4b79dfc51babe774",
  "0xd0e9f86a01fe71e0db8e6b6c4abf72153a14b6f9c8e1e6cf91b1234567890abcd",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x1111111111111111111111111111111111111111111111111111111111111111",
];

const SAMPLE_TX =
  "5HwAr7Vk3JQk3wYqvJpVwT8YsFBcF6F4wXyMcN2pZmXLqVqLwT4kHrYRjBcQpDsk";

const NOW = Date.now();

export default async function DevPage() {
  const [list, stats, globalPayments] = await Promise.all([
    listProjects({ sort: "trending", limit: 6 }),
    getGlobalStats(),
    getRecentPaymentsGlobal(6),
  ]);
  const first = list.items[0];
  const holders = first ? await getHolders(first.id) : [];

  return (
    <main className="py-16">
      <Container>
        <div className="mb-12">
          <MonoLabel>Pandabox / dev sandbox</MonoLabel>
          <h1 className="mt-3 text-4xl">Primitives</h1>
          <p className="mt-2 max-w-prose text-ink/60">
            Visual register for the building blocks. Anything new in the product
            is built from these.
          </p>
          {/* Modal previews — full-page routes that mount real modals with
              fixture data, so we can iterate on them without going through a
              live transaction. */}
          <nav
            aria-label="Modal previews"
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            <span className="font-mono-label text-[10px] text-ink/40">
              modal previews
            </span>
            <a
              href="/dev/deploy-success"
              className="inline-flex h-7 items-center border border-ink/25 px-2.5 font-mono-label text-[10px] text-ink/70 transition-colors hover:border-ink hover:text-ink"
            >
              deploy-success
            </a>
            <a
              href="/dev/withdraw-success"
              className="inline-flex h-7 items-center border border-ink/25 px-2.5 font-mono-label text-[10px] text-ink/70 transition-colors hover:border-ink hover:text-ink"
            >
              withdraw-success
            </a>
          </nav>
        </div>

        <Section label="01 / Mono-label + accent rule">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {accents.map((c, i) => (
              <AccentRule key={c} color={c}>
                <MonoLabel accent={c}>
                  {String(i + 1).padStart(2, "0")} · {c}
                </MonoLabel>
                <h2 className="mt-2 text-2xl">A heading with accent</h2>
                <p className="mt-2 text-sm text-ink/60">
                  Each accent earns one semantic role. Read CLAUDE.md §5.5.
                </p>
              </AccentRule>
            ))}
          </div>
        </Section>

        <Section label="02 / Marker (one per viewport)">
          <p className="text-2xl">
            Fund what's <Marker color="saffron">worth</Marker> funding. On Sui.
          </p>
        </Section>

        <Section label="03 / Hairlines">
          <Hairline />
          <div className="grid grid-cols-3 py-6">
            <div className="px-4">
              <MonoLabel>Cell</MonoLabel>
              <div className="mt-1 font-mono tabular-nums text-2xl">
                142,584
              </div>
            </div>
            <div className="px-4 border-l border-ink/15">
              <MonoLabel>Cell</MonoLabel>
              <div className="mt-1 font-mono tabular-nums text-2xl">18,923</div>
            </div>
            <div className="px-4 border-l border-ink/15">
              <MonoLabel>Cell</MonoLabel>
              <div className="mt-1 font-mono tabular-nums text-2xl">1,247</div>
            </div>
          </div>
          <Hairline />
        </Section>

        <Section label="04 / Diecut shape">
          <div className="flex flex-wrap items-center gap-4">
            <Diecut className="bg-ink px-6 py-3 text-bone">
              <span className="font-mono-label">Launch a project</span>
            </Diecut>
            <Diecut className="border border-ink px-6 py-3 text-ink">
              <span className="font-mono-label">Explore projects</span>
            </Diecut>
            <Diecut className="bg-saffron px-3 py-1 text-ink">
              <span className="font-mono-label">live</span>
            </Diecut>
            <Diecut className="bg-sky/20 px-3 py-1 text-sky">
              <span className="font-mono-label">queued</span>
            </Diecut>
            <Diecut className="bg-plum/20 px-3 py-1 text-plum">
              <span className="font-mono-label">closed</span>
            </Diecut>
          </div>
        </Section>

        <Section label="05 / Frame (max one per viewport)">
          <Frame className="max-w-md">
            <MonoLabel>Project deployed</MonoLabel>
            <div className="mt-2 font-mono text-sm break-all">
              0x12345678…abcdef12
            </div>
            <p className="mt-3 text-sm text-ink/70">
              A certificate-grade surface. Used sparingly.
            </p>
          </Frame>
        </Section>

        <Section label="06 / Noise (hero-only)">
          <div className="relative h-40 overflow-hidden bg-bone">
            <NoiseLayer />
            <div className="relative z-10 flex h-full items-center justify-center">
              <MonoLabel>Noise overlay sample</MonoLabel>
            </div>
          </div>
        </Section>

        <Section label="07 / Addresses">
          <div className="space-y-2">
            {SAMPLE_ADDRS.map((a) => (
              <div key={a} className="flex items-center gap-3">
                <Identicon value={a} size={20} />
                <Address value={a} link />
              </div>
            ))}
          </div>
        </Section>

        <Section label="08 / Identicons">
          <div className="flex flex-wrap items-center gap-4">
            {SAMPLE_ADDRS.map((a) => (
              <div key={a} className="flex flex-col items-center gap-2">
                <Identicon value={a} size={56} />
                <MonoLabel className="text-[10px]">
                  {a.slice(2, 6)}…{a.slice(-4)}
                </MonoLabel>
              </div>
            ))}
          </div>
        </Section>

        <Section label="09 / Amounts">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <MonoLabel>SUI · exact</MonoLabel>
              <div className="mt-2 text-2xl">
                <SuiAmount mist={1234567890n} maxFractionDigits={4} />
              </div>
            </div>
            <div>
              <MonoLabel>SUI · compact</MonoLabel>
              <div className="mt-2 text-2xl">
                <SuiAmount mist={142584_000_000_000n} compact />
              </div>
            </div>
            <div>
              <MonoLabel>Token · compact + ticker</MonoLabel>
              <div className="mt-2 text-2xl">
                <TokenAmount
                  raw={"18923456789000000"}
                  decimals={9}
                  ticker="PANS"
                  compact
                />
              </div>
            </div>
            <div>
              <MonoLabel>Token · integer</MonoLabel>
              <div className="mt-2 text-2xl">
                <TokenAmount raw={1247} ticker="PROJECTS" />
              </div>
            </div>
            <div>
              <MonoLabel>SUI · sub-cent</MonoLabel>
              <div className="mt-2 text-2xl">
                <SuiAmount mist={3400000n} maxFractionDigits={6} />
              </div>
            </div>
            <div>
              <MonoLabel>SUI · large</MonoLabel>
              <div className="mt-2 text-2xl">
                <SuiAmount
                  mist={1_234_567_890_000_000n}
                  maxFractionDigits={2}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section label="10 / Relative time">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["just now", NOW - 4_000],
              ["12m ago", NOW - 12 * 60_000],
              ["2h 30m ago", NOW - (2 * 3600 + 30 * 60) * 1000],
              ["2d 14h ago", NOW - (2 * 86400 + 14 * 3600) * 1000],
              ["in 4d 12h", NOW + (4 * 86400 + 12 * 3600) * 1000],
              ["in 30m", NOW + 30 * 60_000],
            ].map(([label, ts]) => (
              <div key={label as string}>
                <MonoLabel>{label as string}</MonoLabel>
                <div className="mt-1">
                  <RelativeTime value={ts as number} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="11 / Tx hash">
          <div className="space-y-2">
            <TxHash value={SAMPLE_TX} />
            <TxHash value={SAMPLE_TX} head={8} tail={6} />
          </div>
        </Section>

        <Section label="12a / Treasury Pulse · hero">
          <TreasuryPulse variant="hero" />
        </Section>

        <Section label="12b / Treasury Pulse · compact">
          <div className="flex items-center gap-4">
            <MonoLabel>Inline masthead</MonoLabel>
            <TreasuryPulse variant="compact" className="w-[180px]" />
          </div>
        </Section>

        <Section label="12 / Indexer · global stats">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat
              label="TVL"
              value={<SuiAmount mist={stats.tvlMist} compact />}
              delta={stats.delta7d.tvlPct}
            />
            <Stat
              label="Projects"
              value={<TokenAmount raw={stats.projectCount} />}
              delta={stats.delta7d.projectsPct}
            />
            <Stat
              label="Supporters"
              value={<TokenAmount raw={stats.supporterCount} compact />}
              delta={stats.delta7d.supportersPct}
            />
            <Stat
              label="Median sale"
              value={<TokenAmount raw={stats.medianSaleDays} ticker="DAYS" />}
            />
          </div>
        </Section>

        <Section label="13 / Indexer · listProjects (trending, 6)">
          <div className="space-y-3">
            {list.items.map((p) => (
              <div key={p.id} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-3 flex items-center gap-2">
                  <Identicon value={p.id} size={20} />
                  <span className="text-sm">{p.name}</span>
                  <span className={`font-mono-label text-${p.accent}`}>
                    · {p.category}
                  </span>
                </div>
                <div className="col-span-3 font-mono text-xs text-ink/60">
                  {p.ticker}
                </div>
                <div className="col-span-3">
                  <SuiAmount mist={p.raisedMist} compact />
                </div>
                <div className="col-span-3 font-mono text-xs text-ink/60">
                  {p.supporters.toLocaleString()} supporters
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="14 / Indexer · recent payments (global, 6)">
          <div className="space-y-1.5 font-mono text-xs">
            {globalPayments.map((pay) => (
              <div
                key={pay.txHash}
                className="grid grid-cols-12 items-center gap-3 text-ink/80"
              >
                <div className="col-span-3">
                  <RelativeTime value={pay.timestamp} />
                </div>
                <div className="col-span-3 truncate">
                  <span className={`text-${pay.projectAccent}`}>●</span>{" "}
                  {pay.projectName}
                </div>
                <div className="col-span-3">
                  <Address value={pay.payer} />
                </div>
                <div className="col-span-3">
                  <SuiAmount mist={pay.amountMist} maxFractionDigits={2} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {first && (
          <Section label={`16 / Indexer · top holders for "${first.name}"`}>
            <div className="space-y-1.5 font-mono text-xs">
              {holders.slice(0, 10).map((h) => (
                <div
                  key={h.address}
                  className="grid grid-cols-12 items-center gap-3 text-ink/80"
                >
                  <div className="col-span-1">
                    <Identicon value={h.address} size={18} />
                  </div>
                  <div className="col-span-6">
                    <Address value={h.address} />
                  </div>
                  <div className="col-span-3">
                    <TokenAmount
                      raw={h.balanceRaw}
                      ticker={first.ticker}
                      compact
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    {h.pctSupply.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </Container>
    </main>
  );
}

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
}) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <div className="mt-1 text-2xl">{value}</div>
      {typeof delta === "number" && (
        <div className="mt-1 font-mono text-xs text-poppy">
          {delta > 0 ? "+" : ""}
          {delta.toFixed(2)}% · 7d
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink/15 py-12">
      <MonoLabel className="mb-6 block">{label}</MonoLabel>
      {children}
    </section>
  );
}

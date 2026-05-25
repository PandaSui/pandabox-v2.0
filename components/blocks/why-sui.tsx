import { getTranslations } from "next-intl/server";
import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RevealOnView } from "@/components/motion";

type Accent = "poppy" | "sky" | "sun";

const ACCENT_HEX: Record<Accent, string> = {
  poppy: "#C47557",
  sky: "#6D8796",
  sun: "#D9C57A",
};

export async function WhySui() {
  const t = await getTranslations("home.whySui");
  return (
    <section className="relative border-t border-ink/15">
      <Container className="py-20 lg:py-28">
        <div className="mb-12 max-w-2xl">
          <AccentRule color="poppy">
            <MonoLabel>{t("eyebrow")}</MonoLabel>
          </AccentRule>
          <h2 className="mt-3 text-3xl md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-prose text-base text-ink/65">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
          <RevealOnView delayMs={0}>
            <WhyCard
              tag={t("cards.gas.tag")}
              accent="poppy"
              heading={t("cards.gas.heading")}
              body={t("cards.gas.body")}
              meta={t("cards.gas.meta")}
              nativeStamp={t("nativeStamp")}
              diagram={<GasCompareDiagram />}
            />
          </RevealOnView>
          <RevealOnView delayMs={80}>
            <WhyCard
              tag={t("cards.ownership.tag")}
              accent="sky"
              heading={t("cards.ownership.heading")}
              body={t("cards.ownership.body")}
              meta="0x2::transfer::transfer<AdminCap>"
              nativeStamp={t("nativeStamp")}
              diagram={<AdminCapHandoffDiagram />}
            />
          </RevealOnView>
          <RevealOnView delayMs={160}>
            <WhyCard
              tag={t("cards.onboarding.tag")}
              accent="sun"
              heading={t("cards.onboarding.heading")}
              body={t("cards.onboarding.body")}
              meta={t("cards.onboarding.meta")}
              nativeStamp={t("nativeStamp")}
              diagram={<SponsoredGasDiagram />}
            />
          </RevealOnView>
        </div>
      </Container>
    </section>
  );
}

function WhyCard({
  tag,
  accent,
  heading,
  body,
  meta,
  nativeStamp,
  diagram,
}: {
  tag: string;
  accent: Accent;
  heading: string;
  body: string;
  meta: string;
  nativeStamp: string;
  diagram: React.ReactNode;
}) {
  const accentDot: Record<Accent, string> = {
    poppy: "bg-poppy",
    sky: "bg-sky",
    sun: "bg-sun",
  };
  return (
    <article
      className={cn(
        "group relative h-full bg-bone border border-ink shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
      )}
    >
      {/* Header band — mirrors how-it-works card chrome */}
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("block h-2 w-2 rounded-full", accentDot[accent])}
            aria-hidden
          />
          <MonoLabel accent={accent} className="text-[10px]">
            {tag}
          </MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
          {nativeStamp}
        </span>
      </header>

      {/* Diagram zone */}
      <div className="relative h-[200px] overflow-hidden border-b border-ink/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #161310 1px, transparent 1.2px)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative h-full">{diagram}</div>
      </div>

      {/* Copy */}
      <div className="px-5 pt-5 pb-4">
        <h3 className="font-display text-2xl leading-tight">{heading}</h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink/65">{body}</p>
      </div>

      {/* Meta footer */}
      <footer className="flex items-center gap-2 border-t border-ink/15 bg-ink/[0.02] px-5 py-3">
        <span aria-hidden className="block h-1 w-1 rounded-full bg-ink/40" />
        <code className="font-mono text-[11px] text-ink/55">{meta}</code>
      </footer>
    </article>
  );
}

/* ───────────────────────── Diagrams ───────────────────────── */

/**
 * Gas comparator — two horizontal hairline meters: a long muted plum bar
 * representing legacy L1 cost ($30) versus a tiny poppy bar for Sui
 * ($0.0003). The bottom bar "spends" by sliding a coin across.
 */
function GasCompareDiagram() {
  const color = ACCENT_HEX.poppy;
  const muted = "#7E685E"; // plum — historical/archive feel
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Top row label + bar — "the rest" */}
      <text
        x="20"
        y="48"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.55"
        letterSpacing="0.14em"
      >
        ETHEREUM
      </text>
      <text
        x="260"
        y="48"
        textAnchor="end"
        fontFamily="var(--font-mono), monospace"
        fontSize="10"
        fill={muted}
        letterSpacing="0.02em"
      >
        ~$30.00
      </text>
      {/* track */}
      <line
        x1="20"
        x2="260"
        y1="60"
        y2="60"
        stroke="rgba(22,19,16,0.12)"
        strokeWidth="1"
      />
      {/* fill — full-width muted bar */}
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "left center",
          animation: "wsu-bar-grow 2.8s ease-out infinite alternate",
        }}
      >
        <rect x="20" y="55" width="240" height="10" fill={muted} opacity="0.65" />
        <rect x="20" y="55" width="240" height="10" fill="none" stroke="#161310" strokeWidth="0.8" />
      </g>

      {/* Mid divider hairline */}
      <line
        x1="20"
        x2="260"
        y1="100"
        y2="100"
        stroke="rgba(22,19,16,0.12)"
        strokeWidth="1"
        strokeDasharray="2 4"
      />

      {/* Bottom row — Sui */}
      <text
        x="20"
        y="128"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.55"
        letterSpacing="0.14em"
      >
        SUI
      </text>
      <text
        x="260"
        y="128"
        textAnchor="end"
        fontFamily="var(--font-mono), monospace"
        fontSize="10"
        fill={color}
        letterSpacing="0.02em"
        fontWeight="600"
      >
        ~$0.0003
      </text>
      <line
        x1="20"
        x2="260"
        y1="140"
        y2="140"
        stroke="rgba(22,19,16,0.12)"
        strokeWidth="1"
      />
      {/* tiny pill — Sui cost */}
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "left center",
          animation: "wsu-bar-grow 2.8s ease-out 0.4s infinite alternate",
        }}
      >
        <rect x="20" y="135" width="8" height="10" fill={color} />
        <rect x="20" y="135" width="8" height="10" fill="none" stroke="#161310" strokeWidth="0.8" />
      </g>

      {/* Tail labels */}
      <text
        x="20"
        y="172"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.14em"
      >
        FEE TO BACK ONE PROJECT
      </text>
      <text
        x="260"
        y="172"
        textAnchor="end"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill={color}
        letterSpacing="0.14em"
      >
        ~100,000× CHEAPER
      </text>

      {/* Indicator dot at end of Sui bar */}
      <circle
        cx="28"
        cy="140"
        r="3"
        fill={color}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "hiw-dot-pulse 1.8s ease-in-out infinite",
        }}
      />
    </svg>
  );
}

/**
 * AdminCap handoff — a diecut "PROJECTADMINCAP" card on the left slides
 * along a hairline track to a multisig (3 connected nodes) on the right.
 * The receiving node pulses on arrival.
 */
function AdminCapHandoffDiagram() {
  const color = ACCENT_HEX.sky;
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Origin label */}
      <text
        x="32"
        y="44"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.14em"
      >
        YOU
      </text>

      {/* Static origin slot — outlined dashed where the cap starts */}
      <rect
        x="22"
        y="78"
        width="60"
        height="44"
        fill="none"
        stroke="rgba(22,19,16,0.25)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* Track between origin and multisig */}
      <line
        x1="82"
        x2="190"
        y1="100"
        y2="100"
        stroke="rgba(22,19,16,0.22)"
        strokeWidth="1"
      />
      <line
        x1="82"
        x2="190"
        y1="100"
        y2="100"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="2 4"
        opacity="0.5"
      />

      {/* The cap — animated handoff */}
      <g
        style={{
          animation: "wsu-handoff 4s ease-in-out infinite",
        }}
      >
        <g transform="translate(22, 78)">
          {/* diecut-like card */}
          <polygon
            points="6,0 54,0 60,6 60,38 54,44 6,44 0,38 0,6"
            fill="#F7F1E3"
            stroke="#161310"
            strokeWidth="1"
          />
          {/* identicon 4×4 */}
          {[
            [0, 0], [2, 0], [3, 0],
            [1, 1], [3, 1],
            [0, 2], [1, 2], [3, 2],
            [0, 3], [2, 3],
          ].map(([cx, cy], i) => (
            <rect
              key={i}
              x={6 + cx * 4}
              y={8 + cy * 4}
              width="3"
              height="3"
              fill={color}
              opacity={0.45 + (i % 3) * 0.2}
            />
          ))}
          {/* label */}
          <text
            x="44"
            y="16"
            fontFamily="var(--font-mono), monospace"
            fontSize="5"
            fill="#161310"
            opacity="0.55"
            letterSpacing="0.14em"
          >
            ADMINCAP
          </text>
          <rect x="26" y="22" width="28" height="2" fill="#161310" opacity="0.5" />
          <rect x="26" y="28" width="18" height="2" fill="#161310" opacity="0.3" />
          <text
            x="44"
            y="40"
            fontFamily="var(--font-mono), monospace"
            fontSize="5"
            fill={color}
            letterSpacing="0.06em"
          >
            0x4f…3a
          </text>
        </g>
      </g>

      {/* Multisig — three connected nodes forming a triangle */}
      <g transform="translate(200, 70)">
        {/* connecting hairlines */}
        <line x1="14" y1="6" x2="46" y2="6" stroke="rgba(22,19,16,0.35)" strokeWidth="0.8" />
        <line x1="14" y1="6" x2="30" y2="48" stroke="rgba(22,19,16,0.35)" strokeWidth="0.8" />
        <line x1="46" y1="6" x2="30" y2="48" stroke="rgba(22,19,16,0.35)" strokeWidth="0.8" />

        {[
          { x: 14, y: 6, d: 0 },
          { x: 46, y: 6, d: 0.3 },
          { x: 30, y: 48, d: 0.6 },
        ].map((n, i) => (
          <g
            key={i}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `hiw-dot-pulse 2s ease-in-out ${n.d}s infinite`,
            }}
          >
            <circle cx={n.x} cy={n.y} r="5" fill={color} />
            <circle
              cx={n.x}
              cy={n.y}
              r="8"
              fill="none"
              stroke={color}
              strokeWidth="0.8"
              opacity="0.4"
            />
          </g>
        ))}

        <text
          x="30"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          MULTISIG 2-OF-3
        </text>
      </g>

      {/* Bottom mono spec — the Move semantic */}
      <text
        x="20"
        y="174"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill="#161310"
        opacity="0.45"
        letterSpacing="0.14em"
      >
        OBJECT-OWNED · TRANSFERABLE IN ONE TX
      </text>
    </svg>
  );
}

/**
 * Sponsored gas — pipeline showing a first-time wallet (no SUI) backing
 * a project because Pandabox sponsors the gas. Gas glyph flows from the
 * sponsor pill into the wallet, then a "TX SIGNED" receipt prints.
 */
function SponsoredGasDiagram() {
  const color = ACCENT_HEX.sun;
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Sponsor pill — Pandabox */}
      <g>
        <rect
          x="14"
          y="80"
          width="64"
          height="36"
          fill={color}
          opacity="0.16"
          stroke="#161310"
          strokeWidth="1"
        />
        <rect
          x="14"
          y="80"
          width="64"
          height="36"
          fill="none"
          stroke={color}
          strokeWidth="0.8"
        />
        <text
          x="46"
          y="96"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          PANDABOX
        </text>
        <text
          x="46"
          y="108"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="8"
          fill={color}
          letterSpacing="0.02em"
          fontWeight="600"
        >
          pays gas
        </text>
      </g>

      {/* Wallet — empty first-time wallet */}
      <g>
        <rect
          x="108"
          y="80"
          width="64"
          height="36"
          fill="#F7F1E3"
          stroke="#161310"
          strokeWidth="1"
        />
        {/* tiny "0 SUI" indicator */}
        <text
          x="140"
          y="96"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          NEW WALLET
        </text>
        <text
          x="140"
          y="108"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="8"
          fill="#161310"
          opacity="0.7"
          letterSpacing="0.02em"
        >
          0.00 SUI
        </text>
      </g>

      {/* Chain — destination, the project */}
      <g>
        <polygon
          points="208,80 254,80 264,90 264,106 254,116 208,116 198,106 198,90"
          fill={color}
          opacity="0.16"
          stroke="#161310"
          strokeWidth="1"
        />
        <polygon
          points="208,80 254,80 264,90 264,106 254,116 208,116 198,106 198,90"
          fill="none"
          stroke={color}
          strokeWidth="0.8"
        />
        <text
          x="231"
          y="96"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          PROJECT
        </text>
        <text
          x="231"
          y="108"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="8"
          fill="#161310"
          letterSpacing="0.02em"
        >
          ::pay
        </text>
      </g>

      {/* Track 1 — sponsor → wallet (gas flow) */}
      <line
        x1="80"
        x2="106"
        y1="98"
        y2="98"
        stroke="rgba(22,19,16,0.22)"
        strokeWidth="1"
      />
      <line
        x1="80"
        x2="106"
        y1="98"
        y2="98"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="2 3"
      />

      {/* Track 2 — wallet → project (tx flow) */}
      <line
        x1="174"
        x2="196"
        y1="98"
        y2="98"
        stroke="rgba(22,19,16,0.22)"
        strokeWidth="1"
      />
      <line
        x1="174"
        x2="196"
        y1="98"
        y2="98"
        stroke="#161310"
        strokeWidth="0.8"
        strokeDasharray="2 3"
        opacity="0.45"
      />

      {/* Gas droplet flowing left → right across both tracks */}
      <g
        style={{
          animation: "hiw-coin-flow 3.4s linear infinite",
        }}
      >
        <g transform="translate(80, 98)">
          {/* drop glyph */}
          <path
            d="M0 -5 C 3 -2 5 1 5 3 A 5 5 0 1 1 -5 3 C -5 1 -3 -2 0 -5 Z"
            fill={color}
            stroke="#161310"
            strokeWidth="0.8"
          />
        </g>
      </g>

      {/* Top label — sponsoring relationship */}
      <text
        x="93"
        y="68"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill={color}
        letterSpacing="0.14em"
      >
        SPONSORS
      </text>
      <text
        x="185"
        y="68"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="6"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.14em"
      >
        SIGNS
      </text>

      {/* Receipt — "TX OK" printed below the wallet on each cycle */}
      <g
        style={{
          animation: "wsu-receipt-print 3.4s ease-in-out 1.6s infinite",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      >
        <rect
          x="116"
          y="138"
          width="48"
          height="22"
          fill="#F7F1E3"
          stroke="#161310"
          strokeWidth="1"
        />
        <text
          x="140"
          y="150"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          RECEIPT
        </text>
        <text
          x="140"
          y="158"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill={color}
          letterSpacing="0.14em"
          fontWeight="600"
        >
          TX OK · 0x9c…
        </text>
      </g>
    </svg>
  );
}

import type { Accent, Category, Project } from "@/types/pandabox";

const MIST = 1_000_000_000n;
const DAY = 86400 * 1000;

// Deterministic "now" for SSR stability — anchor mocks to a fixed clock.
// In a real indexer this isn't needed; for mocks it keeps hydration clean.
export const MOCK_NOW = 1747353600000; // 2025-05-16 00:00:00 UTC

type Seed = Omit<
  Project,
  | "id"
  | "packageId"
  | "adminCapId"
  | "creator"
  | "deployedAt"
  | "cycleStart"
  | "cycleEnd"
  | "tiers"
  | "queuedReconfiguration"
> & {
  daysSinceDeploy: number;
  cycleProgress: number;
  cycleDurationDays: number;
  hasTiers: boolean;
  queued?: { inDays: number; summary: string };
};

const SEEDS: Seed[] = [
  {
    name: "Atelier Ono",
    ticker: "OONO",
    tagline: "A photo-zine collective minting weekly drops on Sui.",
    description:
      "Atelier Ono is a worker-owned photo-zine collective. Each cycle, supporters receive OONO tokens redeemable against the printing-press surplus.",
    category: "art",
    accent: "saffron",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 14_240n * MIST,
    supporters: 612,
    cycleNumber: 7,
    params: {
      weight: 1_000_000n,
      reservedRate: 8,
      cashOutTax: 12,
      issuanceReduction: 3,
      payoutLimitMist: 9_000n * MIST,
      ballotDelayHours: 72,
    },
    socials: { twitter: "atelierono", website: "ono.art" },
    daysSinceDeploy: 92,
    cycleProgress: 0.62,
    cycleDurationDays: 14,
    hasTiers: true,
  },
  {
    name: "Sui Indexer Commons",
    ticker: "IDX",
    tagline: "An open indexer fleet for Sui builders, owned by its users.",
    description:
      "A community-funded indexer infrastructure for the Sui ecosystem. Treasury pays node operators directly each cycle.",
    category: "infra",
    accent: "poppy",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 38_180n * MIST,
    supporters: 1_142,
    cycleNumber: 12,
    params: {
      weight: 750_000n,
      reservedRate: 15,
      cashOutTax: 25,
      issuanceReduction: 5,
      payoutLimitMist: 24_000n * MIST,
      ballotDelayHours: 168,
    },
    socials: { twitter: "suiidxcommons", website: "idx.commons" },
    daysSinceDeploy: 168,
    cycleProgress: 0.31,
    cycleDurationDays: 14,
    hasTiers: false,
    queued: { inDays: 6, summary: "Raise reserved rate to 18%, extend ballot delay to 10d." },
  },
  {
    name: "Council of Bamboo",
    ticker: "BAMBOO",
    tagline: "A DAO funding small Move libraries the rest of Sui depends on.",
    description:
      "A community DAO that grant-funds Move libraries and shared tooling. Token holders ratify grants each cycle.",
    category: "dao",
    accent: "jade",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 9_840n * MIST,
    supporters: 387,
    cycleNumber: 4,
    params: {
      weight: 1_200_000n,
      reservedRate: 20,
      cashOutTax: 8,
      issuanceReduction: 2,
      payoutLimitMist: 6_000n * MIST,
      ballotDelayHours: 96,
    },
    socials: { twitter: "councilbamboo", website: "bamboo.dao" },
    daysSinceDeploy: 56,
    cycleProgress: 0.88,
    cycleDurationDays: 14,
    hasTiers: false,
  },
  {
    name: "Heron Research",
    ticker: "HERON",
    tagline: "Open-access reproducible papers on consumer crypto.",
    description:
      "A research collective publishing reproducible reports on consumer crypto adoption. Funded entirely by reader subscriptions through Pandabox.",
    category: "research",
    accent: "sky",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 6_220n * MIST,
    supporters: 248,
    cycleNumber: 9,
    params: {
      weight: 900_000n,
      reservedRate: 5,
      cashOutTax: 18,
      issuanceReduction: 7,
      payoutLimitMist: 4_500n * MIST,
      ballotDelayHours: 48,
    },
    socials: { twitter: "heronresearch", website: "heron.report" },
    daysSinceDeploy: 124,
    cycleProgress: 0.45,
    cycleDurationDays: 14,
    hasTiers: true,
  },
  {
    name: "Marigold Studios",
    ticker: "MARI",
    tagline: "A two-person studio shipping co-op puzzlers on Sui.",
    description:
      "An indie game studio funding production of a co-op puzzle game. Supporters receive MARI tokens plus optional early-access NFT passes.",
    category: "gaming",
    accent: "sun",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 22_500n * MIST,
    supporters: 884,
    cycleNumber: 3,
    params: {
      weight: 800_000n,
      reservedRate: 12,
      cashOutTax: 30,
      issuanceReduction: 4,
      payoutLimitMist: 15_000n * MIST,
      ballotDelayHours: 168,
    },
    socials: { twitter: "marigoldstudios", website: "marigold.gg" },
    daysSinceDeploy: 42,
    cycleProgress: 0.74,
    cycleDurationDays: 14,
    hasTiers: true,
  },
  {
    name: "Plum Records",
    ticker: "PLUM",
    tagline: "A net label paying its artists every cycle, on chain.",
    description:
      "A net-label experimenting with on-chain royalty distribution. Each release is a cycle; supporters get tokens that cash out against surplus.",
    category: "music",
    accent: "plum",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 4_120n * MIST,
    supporters: 196,
    cycleNumber: 11,
    params: {
      weight: 1_500_000n,
      reservedRate: 25,
      cashOutTax: 15,
      issuanceReduction: 6,
      payoutLimitMist: 3_000n * MIST,
      ballotDelayHours: 72,
    },
    socials: { twitter: "plumrecords", website: "plum.fm" },
    daysSinceDeploy: 154,
    cycleProgress: 0.18,
    cycleDurationDays: 14,
    hasTiers: false,
  },
  {
    name: "Lanterns",
    ticker: "LTRN",
    tagline: "A pseudonymous social client paying its moderators in surplus.",
    description:
      "A pseudonymous social-feed client. Moderators are paid in LTRN out of treasury surplus every cycle.",
    category: "social",
    accent: "jade",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 17_900n * MIST,
    supporters: 1_021,
    cycleNumber: 6,
    params: {
      weight: 600_000n,
      reservedRate: 18,
      cashOutTax: 22,
      issuanceReduction: 5,
      payoutLimitMist: 12_000n * MIST,
      ballotDelayHours: 96,
    },
    socials: { twitter: "lanternsapp", website: "lanterns.social" },
    daysSinceDeploy: 84,
    cycleProgress: 0.55,
    cycleDurationDays: 14,
    hasTiers: false,
  },
  {
    name: "Estuary RWA",
    ticker: "EST",
    tagline: "Tokenized salt-marsh restoration credits with on-chain audits.",
    description:
      "Estuary tokenizes salt-marsh restoration credits from US east-coast sites. Treasury pays site operators each cycle against verified delivery.",
    category: "rwa",
    accent: "sky",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 51_300n * MIST,
    supporters: 421,
    cycleNumber: 5,
    params: {
      weight: 500_000n,
      reservedRate: 10,
      cashOutTax: 35,
      issuanceReduction: 8,
      payoutLimitMist: 36_000n * MIST,
      ballotDelayHours: 240,
    },
    socials: { twitter: "estuaryrwa", website: "estuary.eco" },
    daysSinceDeploy: 70,
    cycleProgress: 0.92,
    cycleDurationDays: 14,
    hasTiers: true,
    queued: { inDays: 2, summary: "Lower cash-out tax to 30%, raise payout limit to 42K SUI." },
  },
  {
    name: "Saffron Books",
    ticker: "SFBK",
    tagline: "A reader-owned press publishing one novella per cycle.",
    description:
      "Saffron Books publishes one short novella per cycle. Supporters receive a print edition NFT plus SFBK tokens.",
    category: "art",
    accent: "saffron",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 7_640n * MIST,
    supporters: 312,
    cycleNumber: 8,
    params: {
      weight: 1_100_000n,
      reservedRate: 12,
      cashOutTax: 10,
      issuanceReduction: 4,
      payoutLimitMist: 5_500n * MIST,
      ballotDelayHours: 72,
    },
    socials: { twitter: "saffronbooks", website: "saffronbooks.press" },
    daysSinceDeploy: 112,
    cycleProgress: 0.40,
    cycleDurationDays: 14,
    hasTiers: true,
  },
  {
    name: "Poppy CDN",
    ticker: "POP",
    tagline: "A user-owned CDN for static Sui-app assets.",
    description:
      "A community-operated CDN for static Sui-app assets. Bandwidth credits sold per cycle; operators paid out of surplus.",
    category: "infra",
    accent: "poppy",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 12_440n * MIST,
    supporters: 540,
    cycleNumber: 10,
    params: {
      weight: 700_000n,
      reservedRate: 14,
      cashOutTax: 20,
      issuanceReduction: 5,
      payoutLimitMist: 8_500n * MIST,
      ballotDelayHours: 96,
    },
    socials: { twitter: "poppycdn", website: "poppy.cdn" },
    daysSinceDeploy: 140,
    cycleProgress: 0.28,
    cycleDurationDays: 14,
    hasTiers: false,
  },
  {
    name: "Sundial DAO",
    ticker: "SUN",
    tagline: "A treasury DAO making weekly grants to Sui hackathon projects.",
    description:
      "Sundial DAO awards weekly grants to Sui hackathon teams. Holders vote on each grant; surplus cashes out monthly.",
    category: "dao",
    accent: "sun",
    coverImage: "/panda-logo.webp",
    status: "live",
    raisedMist: 28_900n * MIST,
    supporters: 712,
    cycleNumber: 14,
    params: {
      weight: 950_000n,
      reservedRate: 16,
      cashOutTax: 14,
      issuanceReduction: 3,
      payoutLimitMist: 20_000n * MIST,
      ballotDelayHours: 168,
    },
    socials: { twitter: "sundialdao", website: "sundial.dao" },
    daysSinceDeploy: 196,
    cycleProgress: 0.66,
    cycleDurationDays: 14,
    hasTiers: false,
  },
  {
    name: "Heron Archive",
    ticker: "ARCH",
    tagline: "A retired research label kept online for posterity.",
    description:
      "Closed cycle. The Heron Archive preserves prior reports; no new payments accepted but tokens remain tradable.",
    category: "research",
    accent: "plum",
    coverImage: "/panda-logo.webp",
    status: "closed",
    raisedMist: 3_280n * MIST,
    supporters: 122,
    cycleNumber: 6,
    params: {
      weight: 800_000n,
      reservedRate: 10,
      cashOutTax: 0,
      issuanceReduction: 0,
      payoutLimitMist: 0n,
      ballotDelayHours: 0,
    },
    socials: { twitter: "heronarchive" },
    daysSinceDeploy: 320,
    cycleProgress: 1,
    cycleDurationDays: 30,
    hasTiers: false,
  },
];

// Deterministic 64-hex Sui-shaped id derived from project name + kind.
function pseudoId(seed: string, kind: "project" | "package" | "cap" | "addr"): string {
  const k = `${kind}:${seed}`;
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return "0x" + out.slice(0, 64);
}

function tiersFor(seed: Seed): Project["tiers"] {
  if (!seed.hasTiers) return [];
  const base: { name: string; price: bigint; max: number; perks: string }[] =
    seed.category === "art"
      ? [
          { name: "Print", price: 5n * MIST, max: 200, perks: "Signed print edition + tokens." },
          { name: "Folio", price: 18n * MIST, max: 50, perks: "Folio bundle, gallery invite, tokens." },
          { name: "Patron", price: 60n * MIST, max: 10, perks: "Credited patron, studio visit, tokens." },
        ]
      : seed.category === "gaming"
        ? [
            { name: "Early access", price: 2n * MIST, max: 500, perks: "Closed-beta key + tokens." },
            { name: "Founder", price: 10n * MIST, max: 100, perks: "Founder badge, name in credits, tokens." },
          ]
        : seed.category === "research"
          ? [
              { name: "Reader", price: 1n * MIST, max: 0, perks: "All current and future reports." },
              { name: "Sponsor", price: 12n * MIST, max: 25, perks: "Logo on report, listed sponsor, tokens." },
            ]
          : [
              { name: "Supporter", price: 3n * MIST, max: 0, perks: "Supporter NFT + tokens." },
              { name: "Anchor", price: 25n * MIST, max: 20, perks: "Anchor tier benefits + tokens." },
            ];
  return base.map((b) => ({
    id: pseudoId(seed.name + b.name, "addr"),
    name: b.name,
    priceMist: b.price,
    maxSupply: b.max,
    minted: Math.min(b.max || 999, Math.round((b.max || 999) * (0.2 + ((seed.name.length * 7) % 50) / 100))),
    image: seed.coverImage,
    perks: b.perks,
  }));
}

export const PROJECTS: Project[] = SEEDS.map((s) => {
  const cycleLen = s.cycleDurationDays * DAY;
  const elapsed = Math.round(cycleLen * s.cycleProgress);
  const cycleStart = MOCK_NOW - elapsed;
  const cycleEnd = cycleStart + cycleLen;
  const deployedAt = MOCK_NOW - s.daysSinceDeploy * DAY;
  return {
    id: pseudoId(s.name, "project"),
    packageId: pseudoId(s.name, "package"),
    adminCapId: pseudoId(s.name + "-cap", "cap"),
    creator: pseudoId(s.name + "-creator", "addr"),
    deployedAt,
    cycleStart,
    cycleEnd,
    tiers: tiersFor(s),
    queuedReconfiguration: s.queued
      ? {
          takesEffectAt: MOCK_NOW + s.queued.inDays * DAY,
          summary: s.queued.summary,
          params: {},
        }
      : null,
    name: s.name,
    ticker: s.ticker,
    tagline: s.tagline,
    description: s.description,
    category: s.category as Category,
    accent: s.accent as Accent,
    coverImage: s.coverImage,
    status: s.status,
    raisedMist: s.raisedMist,
    supporters: s.supporters,
    cycleNumber: s.cycleNumber,
    params: s.params,
    socials: s.socials,
  };
});

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

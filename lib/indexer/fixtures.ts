import type { Accent, Category, Project, UnsoldAction } from "@/types/pandabox";

const MIST = 1_000_000_000n;
const DAY = 86400 * 1000;

// Deterministic "now" for SSR stability — anchor mocks to a fixed clock.
// In a real indexer this isn't needed; for mocks it keeps hydration clean.
export const MOCK_NOW = 1747353600000; // 2025-05-16 00:00:00 UTC

// 100 亿 × 10^9 decimals — fixed by contract.
const TOTAL_SUPPLY_RAW = 10_000_000_000n * 1_000_000_000n;

type Seed = Omit<
  Project,
  | "id"
  | "packageId"
  | "adminCapId"
  | "creator"
  | "deployedAt"
  | "tiers"
  | "endTimeMs"
  | "alreadyMinted"
> & {
  daysSinceDeploy: number;
  /** null = no time cap (admin-closed only). */
  endInDays: number | null;
  hasTiers: boolean;
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
    coinType: "0xa5fd521610eaba7a65601f79fe5b898a7eef83f94cf2019900df6c512df5e5c1::oono::OONO",
    weight: 1_000_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "atelierono", website: "ono.art" },
    daysSinceDeploy: 92,
    endInDays: 21,
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
    coinType: "0xc9523f683256502be15ec4979098d510f67b6d3f0df02eebf124515014433270::idx::IDX",
    weight: 750_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "transfer_to_creator",
    socials: { twitter: "suiidxcommons", website: "idx.commons" },
    daysSinceDeploy: 168,
    endInDays: 45,
    hasTiers: false,
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
    coinType: "0x12b843d5322953a53c689975664a22e9ba5db52876a7d89c4b79dfc51babe774::bamboo::BAMBOO",
    weight: 1_200_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "councilbamboo", website: "bamboo.dao" },
    daysSinceDeploy: 56,
    endInDays: 14,
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
    coinType: "0xd0e9f86a01fe71e0db8e6b6c4abf72153a14b6f9c8e1e6cf91b1234567890abcd::heron::HERON",
    weight: 900_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "heronresearch", website: "heron.report" },
    daysSinceDeploy: 124,
    endInDays: null,
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
    coinType: "0x1111111111111111111111111111111111111111111111111111111111111111::mari::MARI",
    weight: 800_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "transfer_to_creator",
    socials: { twitter: "marigoldstudios", website: "marigold.gg" },
    daysSinceDeploy: 42,
    endInDays: 30,
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
    coinType: "0x2222222222222222222222222222222222222222222222222222222222222222::plum::PLUM",
    weight: 1_500_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "plumrecords", website: "plum.fm" },
    daysSinceDeploy: 154,
    endInDays: 60,
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
    coinType: "0x3333333333333333333333333333333333333333333333333333333333333333::ltrn::LTRN",
    weight: 600_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "lanternsapp", website: "lanterns.social" },
    daysSinceDeploy: 84,
    endInDays: 12,
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
    coinType: "0x4444444444444444444444444444444444444444444444444444444444444444::est::EST",
    weight: 500_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "transfer_to_creator",
    socials: { twitter: "estuaryrwa", website: "estuary.eco" },
    daysSinceDeploy: 70,
    endInDays: 7,
    hasTiers: true,
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
    coinType: "0x5555555555555555555555555555555555555555555555555555555555555555::sfbk::SFBK",
    weight: 1_100_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "saffronbooks", website: "saffronbooks.press" },
    daysSinceDeploy: 112,
    endInDays: 35,
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
    coinType: "0x6666666666666666666666666666666666666666666666666666666666666666::pop::POP",
    weight: 700_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "poppycdn", website: "poppy.cdn" },
    daysSinceDeploy: 140,
    endInDays: 90,
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
    coinType: "0x7777777777777777777777777777777777777777777777777777777777777777::sun::SUN",
    weight: 950_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "transfer_to_creator",
    socials: { twitter: "sundialdao", website: "sundial.dao" },
    daysSinceDeploy: 196,
    endInDays: 50,
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
    coinType: "0x8888888888888888888888888888888888888888888888888888888888888888::arch::ARCH",
    weight: 800_000n,
    allocationTokens: TOTAL_SUPPLY_RAW,
    unsoldAction: "burn",
    socials: { twitter: "heronarchive" },
    daysSinceDeploy: 320,
    endInDays: -10,
    hasTiers: false,
  },
];

// Deterministic 64-hex Sui-shaped id derived from project name + kind.
function pseudoId(
  seed: string,
  kind: "project" | "package" | "cap" | "addr",
): string {
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
          {
            name: "Print",
            price: 5n * MIST,
            max: 200,
            perks: "Signed print edition + tokens.",
          },
          {
            name: "Folio",
            price: 18n * MIST,
            max: 50,
            perks: "Folio bundle, gallery invite, tokens.",
          },
          {
            name: "Patron",
            price: 60n * MIST,
            max: 10,
            perks: "Credited patron, studio visit, tokens.",
          },
        ]
      : seed.category === "gaming"
        ? [
            {
              name: "Early access",
              price: 2n * MIST,
              max: 500,
              perks: "Closed-beta key + tokens.",
            },
            {
              name: "Founder",
              price: 10n * MIST,
              max: 100,
              perks: "Founder badge, name in credits, tokens.",
            },
          ]
        : seed.category === "research"
          ? [
              {
                name: "Reader",
                price: 1n * MIST,
                max: 0,
                perks: "All current and future reports.",
              },
              {
                name: "Sponsor",
                price: 12n * MIST,
                max: 25,
                perks: "Logo on report, listed sponsor, tokens.",
              },
            ]
          : [
              {
                name: "Supporter",
                price: 3n * MIST,
                max: 0,
                perks: "Supporter NFT + tokens.",
              },
              {
                name: "Anchor",
                price: 25n * MIST,
                max: 20,
                perks: "Anchor tier benefits + tokens.",
              },
            ];
  return base.map((b) => ({
    id: pseudoId(seed.name + b.name, "addr"),
    name: b.name,
    priceMist: b.price,
    maxSupply: b.max,
    minted: Math.min(
      b.max || 999,
      Math.round((b.max || 999) * (0.2 + ((seed.name.length * 7) % 50) / 100)),
    ),
    image: seed.coverImage,
    perks: b.perks,
  }));
}

export const PROJECTS: Project[] = SEEDS.map((s) => {
  const deployedAt = MOCK_NOW - s.daysSinceDeploy * DAY;
  const endTimeMs = s.endInDays === null ? null : MOCK_NOW + s.endInDays * DAY;
  // Mock: minted tokens are derived from raised SUI × weight (matches the
  // contract's fixed-price formula). Real indexer reads this from chain.
  const alreadyMinted = (s.raisedMist * s.weight) / MIST;
  return {
    id: pseudoId(s.name, "project"),
    packageId: pseudoId(s.name, "package"),
    adminCapId: pseudoId(s.name + "-cap", "cap"),
    creator: pseudoId(s.name + "-creator", "addr"),
    deployedAt,
    tiers: tiersFor(s),
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
    coinType: s.coinType,
    weight: s.weight,
    allocationTokens: s.allocationTokens,
    alreadyMinted,
    unsoldAction: s.unsoldAction as UnsoldAction,
    endTimeMs,
    socials: s.socials,
  };
});

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

# Pandabox — Build Brief for Claude Code (Opus 4.7)

> A programmable, fully on-chain funding launchpad on **Sui Network**. Pandabox is to Sui what Juicebox is to Ethereum — projects raise SUI, issue tokens via configurable bonding curves, optionally mint tiered NFT supporter passes, define payout splits, run on locked funding cycles, and let supporters cash out their tokens against treasury surplus. Every parameter is on-chain. Every transaction is a Sui programmable transaction block.
>
> You are the senior frontend engineer and creative director executing this build. Read this entire document before writing a single line of code.

---

## 0. North Star — Read This First

**One sentence:** _A precision-engineered launchpad for crypto-natives, with the polish of a Series-A SaaS and the kinetic confidence of a Sui-native DEX._

**The conviction.** Modern crypto products that win design awards in 2025–2026 all share one trait: **a single aesthetic conviction, executed at every scale.** Phantom went purple-violet futurism. Backpack went monochrome utility. Aerodrome went bauhaus geometry. Coinbase rejected category visual grammar entirely. Pandabox's conviction is this:

> **Engineered minimalism with one signature kinetic moment.**

We commit to:
- A confident, restrained light surface — our bone/paper background is a *feature*, not a quirk. Almost no dapp on Sui is light-mode-first; that's our flag.
- Heavy, deliberate use of mono numerics. Every figure in this product is a real on-chain number. Make them legible, alignable, almost spreadsheet-grade.
- Hairlines and diecut geometry as the structural language. No glassmorphism. No purple glows. No gradient buttons.
- The six accent colors (saffron, poppy, jade, sky, sun, plum) used as **semantic tokens**, not decoration. Each color earns its meaning.
- One signature kinetic interaction (defined in §3) that makes the site memorable in 5 seconds.

**Three feelings the product must evoke:**
1. **Crypto-native confidence.** Built by people who shipped on-chain. Real addresses, real cycles, real tx hashes — surfaced as first-class typography, not hidden behind "Connect Wallet to view".
2. **Engineered restraint.** Linear-level discipline. Vercel-level type rendering. Cetus-level data density. Nothing extra.
3. **Quiet personality.** A panda mark, a confetti accent system, a marker-highlight motif used *once or twice per surface as punctuation* — never as theme. The personality is in the details, not the chrome.

**Anti-patterns to delete from your mind before starting:**
- Editorial / newspaper / zine framing. We're not a publication, we're infrastructure.
- Generic web3 chrome: gradient buttons, glassmorphism, neon glows, dark mode by default.
- Pumpfun / casino energy: candy colors, fart-pump aesthetics, "🚀 LFG" copy.
- SaaS template look: `bg-white rounded-lg shadow-md`, three-feature grid with three colored gradient blobs, "Trusted by" logo row.
- Skeuomorphic crypto: 3D coins floating in space, hexagonal "blockchain" patterns, fake terminals.

---

## 1. Tech Stack (Non-Negotiable)

```
Framework:        Next.js 16 (App Router, React 19, RSC default)
Language:         TypeScript, strict
Styling:          Tailwind v3 (your existing config) + the existing globals.css
Wallet & Chain:   @mysten/dapp-kit-react (NEW package, gRPC-ready)
                  @mysten/sui (TypeScript SDK)
                  @tanstack/react-query (peer of dApp Kit)
Animation:        GSAP + @gsap/react (useGSAP — never useEffect for GSAP)
                  Framer Motion for component-level micro-interactions
                  Lenis for buttery scroll (one of the few cases it's justified)
State:            Zustand for cross-component client state
Forms:            react-hook-form + zod
Numerics:         bignumber.js, plus Sui's MIST helpers — NEVER plain JS numbers for amounts
Charts:           Recharts (themes naturally to hairline aesthetic)
Icons:            Lucide React at stroke-width 1.5; custom inline SVGs for signature glyphs
Package manager:  npm (your standing preference)
```

### Sui provider setup (must work with RSC)

Wallet providers live in a `'use client'` boundary. Create `app/providers.tsx`:

```tsx
'use client';
import '@mysten/dapp-kit-react/dist/index.css';
import { createDAppKit, DAppKitProvider } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  const [dAppKit] = useState(() => createDAppKit({
    networks: ['testnet', 'mainnet'],
    defaultNetwork: process.env.NEXT_PUBLIC_SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    createClient: (network) => new SuiGrpcClient({
      network,
      baseUrl: network === 'mainnet'
        ? 'https://fullnode.mainnet.sui.io:443'
        : 'https://fullnode.testnet.sui.io:443',
    }),
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  );
}
```

Wrap `{children}` with `<Providers>` in `app/layout.tsx`. Keep the layout itself a Server Component.

> **Why dapp-kit-react (new) over legacy:** the legacy `@mysten/dapp-kit` is JSON-RPC only and is no longer being updated. `@mysten/dapp-kit-react` + `@mysten/sui/grpc` is the path forward. If a tutorial uses `<SuiClientProvider>` and `<WalletProvider>` as two separate components — that's the legacy API. We're not using it.

---

## 2. The Mental Model (Read Twice)

Pandabox lets a creator deploy a **Project** — a Move object that owns a **Treasury**. Behavior over time is governed by **Funding Cycles**. Each cycle is a locked window (e.g. 14 days) during which:

- The project receives **SUI payments**.
- Payers receive **Project Tokens** at a rate set by the cycle's `weight` (e.g. 1,000,000 tokens per 1 SUI).
- A **Reserved Rate** (0–50%) of newly minted tokens is held back and split among pre-programmed addresses (team, treasury, partners).
- A **Payout Limit** caps how much SUI can be distributed from the treasury each cycle. Any SUI beyond the limit is **surplus** (Juicebox calls this "overflow").
- Holders can **cash out** (burn tokens) to reclaim a proportional share of surplus — moderated by a **Cash-Out Tax** rate.
- An **Issuance Reduction** rate (0–20%) decreases next cycle's weight, rewarding early supporters.
- Reconfigurations must be queued before a **Ballot Delay** — they only take effect next cycle. This is the trust guarantee.
- Optionally, projects define **NFT Tiers** — paying ≥ tier price gets a tier NFT plus the tokens. Tiers can be capped supply.

**Two ownership artifacts the user must understand:**
1. **ProjectAdminCap** — a Sui object minted to the creator on deploy. Holding it = admin rights. Transfer to a multisig for decentralized governance.
2. **Project Tokens** — fungible, freely tradable, cash-outable for surplus.

**The funding cycle "clock"** is the most important UI element on a project page. Always show: cycle number, time remaining, queued reconfiguration (if any), and ballot-delay status.

---

## 3. The Signature Move (Awwwards Hook)

Every award-tier site has **one thing** that gets it cited. Ours is this:

### The Treasury Pulse

A live, persistent visual element — hero-centered on the landing, compact on internal pages — rendering the **aggregate Pandabox treasury flow** as a kinetic SVG: thin hairlines pulsing on every payment event, faint diecut "ticks" registering each new transaction, mono-numeric counters incrementing in real time.

Picture an EKG, but for SUI flow across the platform — no charts, no glow, just **lines breathing** when the chain breathes. On the landing it occupies center stage, ~720×360, with `mask-fade-x` at the edges. On internal pages it sits inline in the masthead at 180×40, still live, still subtle. Built with SVG + GSAP, ~120 LOC, no external libs.

Behaviorally:
- Subscribes to recent payment events via `useSuiClientQuery` (poll every 6s in v1; WS subscription post-mainnet)
- New events draw a fresh hairline path from right to left, fading the oldest out
- Larger payments produce taller peaks, color-coded by category (saffron for art, poppy for infra, jade for DAO, etc.)
- A mono counter below increments visibly when an event lands — a 200ms count-up using `requestAnimationFrame`

This is the single thing that makes the landing feel **alive in a way no other Sui launchpad does**. Build it carefully; it's the demo reel moment.

A secondary kinetic moment: **split-flap counters** on numbers that update — total raised across the platform, project counts on the fact strip — tick character-by-character on update like an airport board. Pure CSS + JS, no libraries.

---

## 4. Information Architecture

```
/                         Landing
/explore                  Project discovery (grid + filters + live pulse)
/create                   Create-project wizard (6 steps)
/p/[projectId]            Project detail (main consumer surface)
/p/[projectId]/cycles     Funding cycle history + queued reconfig
/p/[projectId]/holders    Token holders + cap table
/p/[projectId]/activity   Full transaction feed
/dashboard                Connected wallet's owned + supported projects
/docs                     Embedded docs (mechanics, glossary, FAQ)
```

App Router conventions. Server-render everything that can be. Wallet-aware UI hydrates via dApp Kit hooks.

---

## 5. Design Language — Engineered Minimalism

Your `globals.css` and `tailwind.config.ts` are the contract. Patterns to formalize:

### 5.1 Type system
- **Display:** `font-display` — used **sparingly**, only for: H1 on landing, H1 on project detail, the one or two pull-numbers per page. Always weight 400. We are not editorial; restrict display type to moments of emphasis.
- **Body:** `font-sans` — workhorse for all UI.
- **Mono:** `font-mono` for: addresses, tx hashes, token amounts, percentages, cycle numbers, timestamps, category labels (the `.font-mono-label` utility — uppercase, 11px, 0.14em tracking).

**Headline hierarchy:**
- H1 (landing hero): `text-7xl md:text-8xl` display, balanced, tight leading
- H1 (project page): `text-5xl md:text-6xl` display
- H2 (section): `text-3xl md:text-4xl` **sans, not display** — restraint matters
- Eyebrow: `.font-mono-label`, ink/60, 12–16px above its heading

> **Important shift from generic web3:** modern crypto-native sites in 2026 don't slap a giant serif on every section header. They use a clean sans for structural headings and reserve serif/display for one or two punctuated moments. Follow that.

### 5.2 Hairlines as structure
Every section divider is a 1px ink/15 line. No thick borders. No shadows for separation. Use `border-t border-ink/15` or `.hairline`. Columns can be ruled with `.rule-v`. This is **the** structural element.

### 5.3 Diecut as the signature shape
The `.diecut` clip-path (14px corner notches) is Pandabox's signature. It reads as a perforated ticket stub, a laser-cut metal panel, an IBM punch card. Use for:
- All primary CTAs (`Launch project`, `Pay 12 SUI`, `Cash out`)
- Category pills on cards
- Status badges (`LIVE`, `QUEUED`, `CLOSED`)
- The Treasury Pulse container frame
- NFT tier cards

Use it consistently — if one primary CTA is diecut, all primary CTAs are diecut.

### 5.4 The frame element (sparingly)
`.frame` (1px ink border with 10×10 corner squares) is reserved for **certificate-like content** — the ProjectAdminCap card on `/dashboard`, the ballot/reconfig confirmation modal, a "Project deployed" success state. Max 1 frame per viewport. Otherwise it loses meaning.

### 5.5 Accent colors as semantics
Each of your six accents maps to a **single role**. Never paint a button saffron because it looks nice — paint it saffron because the role demands it.

| Color   | Hex       | Semantic role                                              |
|---------|-----------|------------------------------------------------------------|
| Saffron | `#B8C45E` | Default accent. Active state. "In progress."               |
| Poppy   | `#C47557` | Inflow. Treasury balance. Warnings (poppy ≠ alarming red)  |
| Jade    | `#6E8E5D` | Community. Token holders. Supporters.                      |
| Sky     | `#6D8796` | Governance. Reconfigurations. Ballot delays.               |
| Sun     | `#D9C57A` | Surplus. Payouts. Distributions. Cash-out value.           |
| Plum    | `#7E685E` | Historical. Closed cycles. Archive.                        |

A project page leans saffron+poppy. A governance/cycle history page leans sky+plum. A payouts breakdown leans sun. **One or two accents per surface.** Never rainbow.

### 5.6 The marker highlighter — restrained
The `.marker` utility is powerful and easy to overuse. Rule: **maximum one marker per viewport**. It's punctuation, not decoration. Reserve for:
- The hero headline (one highlighted word, saffron)
- The active item in the filter bar
- A pull-number on a project page (current raised, saffron)

Never on body copy, never on nav labels, never on multiple things at once.

### 5.7 Noise — used once
The `.noise` overlay is for the **landing hero only**. One surface, full stop. Restraint is visible.

### 5.8 Numerics — spreadsheet-grade
- Token amounts: mono, `tabular-nums`, grouped (`1,234,567.89`)
- Percentages: mono, max 2 decimals (`12.45%`)
- Addresses: mono, truncated `0x12345678…abcdef12` (Sui = 32 bytes, 64 hex — truncate 8+8, NOT Ethereum's 6+4), one-click copy
- Time: mono ISO for absolute (`2026-05-23 14:32 UTC`), prose for relative (`2d 14h left`)
- SUI symbol: custom 12×12 inline SVG glyph flush before the number — never the Sui logo PNG

### 5.9 Motion vocabulary
- Page transitions: 320ms ink overlay sweep using `clip-path: inset(...)`, `ease-atelier`
- Hover lifts: max 2px translateY, max 1.02 scale, 180ms `ease-out`
- Card enter: translateY(20px) → 0, opacity 0 → 1, 40ms stagger, IntersectionObserver-triggered
- Hero headline: word-level fade-up, 12px translate, 40ms stagger
- Split-flap counters: 200ms `ease-atelier` per digit
- Treasury Pulse: continuous GSAP timeline, paused offscreen via IntersectionObserver
- Honor `prefers-reduced-motion` always

### 5.10 The dark mode question
**v1: light-mode only.** Don't ship dark mode. Every Sui dapp is dark-mode-first; being firmly light is the visual signature. Add dark in v2 as opt-in, after the light identity is fully ingrained.

---

## 6. Page Specs

### 6.1 `/` Landing

Mood: **a crypto-native product page in the spirit of Linear, Vercel, or Phantom — but in your bone-paper palette instead of dark-mode purple**.

**Section 1 — Hero (100vh, full bleed)**
- Top nav: thin masthead with the panda mark left, simple text nav center (`Explore`, `Create`, `Docs`), connect button right. Hairline below.
- Small mono-label pill ~80px below the nav: `LIVE ON SUI MAINNET` with a 6px saffron pulse dot
- Headline (`text-7xl md:text-8xl` display, max-w ~16ch, balanced): _"Fund what's worth funding. On Sui."_ — the word "worth" gets the saffron `.marker` (the page's one allowed marker)
- Subhead (`text-lg md:text-xl` sans, ink/70, max-w ~52ch): _"Pandabox is the programmable funding platform for Sui. Launch a project in minutes. Receive SUI, issue tokens, define payouts — all on-chain, all transparent, all yours."_
- CTA row: primary `Launch a project` (diecut, ink-fill, white type) + secondary `Explore projects` (diecut outline)
- Below CTAs: live data strip — `1,247 PROJECTS · 142,584 SUI RAISED · 18,923 SUPPORTERS`, all numbers using split-flap ticker animation

`.noise` applies to the hero container only.

**Section 2 — The Treasury Pulse (the signature moment)**
Full-width section, 80vh. Pulse SVG centered, ~720×360. Above: mono-label `LIVE ACROSS PANDABOX`. Below: single mono row showing the most recent payment — `someproject ← 12.4 SUI · 0xab…cd · just now`. Hairlines above and below the section, otherwise pure space around the Pulse. **This is the demo-reel moment.**

**Section 3 — How it works (3-up)**
Three columns, hairline-divided vertically:
- Eyebrow: mono-label `01` / `02` / `03` (each with one of saffron, poppy, jade as a 4px accent rule)
- Heading: `text-2xl` sans (not display)
- Two-sentence body in `text-base` sans, ink/70
- Small inline glyph (24×24 SVG, stroke 1.5) above the eyebrow — geometric and modern

Steps: (1) **Deploy** — configure cycles, payouts, tokens, optional NFT tiers. (2) **Receive** — supporters pay SUI, receive tokens and tier NFTs. (3) **Reconfigure** — propose changes that take effect next cycle, after the ballot delay.

**Section 4 — Featured projects (3-up large)**
Three large project cards, 4:3 aspect, with the card pattern from §7.3. Above: H2 `Funded right now` with a saffron accent rule.

**Section 5 — Numbers that matter**
Dense 4-column mono stat row (the "fact strip"):
- `TOTAL VALUE LOCKED` · large number · 7d delta in poppy
- `ACTIVE PROJECTS` · count · 7d delta
- `SUPPORTERS` · count · 7d delta
- `MEDIAN CYCLE LENGTH` · days

Hairline-divided cells, mono numerics. This is the moment crypto-natives nod — real numbers, no fluff.

**Section 6 — Why Sui (differentiation)**
Three columns: (1) **Sub-cent gas** — supporters don't pay $30 to back a project. (2) **Object-centric ownership** — your ProjectAdminCap is a real Sui object, transferable to a multisig. (3) **Sponsored transactions** — onboard supporters who don't yet hold SUI. Each column gets a small geometric glyph + 2 sentences.

**Section 7 — Final CTA**
Centered, 60vh. H2 display: _"Your project, on-chain in 12 minutes."_ Big diecut CTA: `Launch a project →`. Hairlines above and below.

**Section 8 — Footer**
Three columns: NAVIGATE · ECOSYSTEM · TECHNICAL. The TECHNICAL column shows the Move package address (mono-truncated, copyable), the Sui network, and the current commit hash. The "real builders" signal.

---

### 6.2 `/explore` Project discovery

Crypto-native shoppers scan 30 projects in 60 seconds.

- Sticky filter bar below the global nav: category pills, sort dropdown (`Trending`, `Newest`, `Most Funded`, `Ending Soonest`), mono-placeholder search
- Active filter pill carries the `.marker` highlight
- Compact Treasury Pulse (180×40) inline in the filter bar's right side
- Grid: 3-col desktop, 2-col tablet, 1-col mobile. Card pattern from §7.3.
- Pagination: load-more button. **Never infinite scroll.**

**Sort indicators:** when sorting by "Most Funded", top 3 cards get a small mono ribbon upper-right: `Nº 01`. Subtle.

**Empty filter state:** single full-width frame element with a mono-line glyph, a mono-label, and one-line prose.

---

### 6.3 `/create` Create-project wizard

Treat as **a developer console** — focused single-task UI with a live data preview, not a marketing-style multi-step form.

**Six steps:**
1. **Identity** — name, ticker, tagline, category, cover image, description (markdown), social links
2. **Cycles** — duration (3d / 7d / 14d / 30d / custom), ballot delay (1d / 3d / 7d / none), first cycle start
3. **Token economics** — initial weight (tokens per SUI), reserved rate (0–50%) with split allocations, issuance reduction (0–20%), cash-out tax (0–100% with explainer)
4. **Payouts** — payout limit (in SUI or USD-via-oracle), splits list, "send surplus to owner" toggle
5. **NFT Tiers (optional)** — 0–10 tiers (name, price, max supply, image, perks blurb). A skip-tiers diecut pill toggles the whole step off.
6. **Review & deploy** — full preview of the resulting project page, big diecut `Deploy to Sui` button, gas estimate, draft-save link, a poppy frame warning explaining what can and can't be changed post-deploy

**Layout pattern:**
- Left rail (40%): the active step's form, single-question-at-a-time, big inputs, generous breathing room
- Right rail (60%): live preview of the project page as it would look, debounced 300ms — the killer feature; the deployer sees exactly what supporters will see

**Special component — the Cycle Simulator** (must build, lives on step 3):
Small interactive viz: "If 100 SUI flows into cycle 1, the team gets X tokens, supporters get Y tokens, and one token cashes out at Z SUI." Slide a SUI-amount input, watch the numbers tick. The deployer-confidence moment.

**State:** Zustand store, persisted to `localStorage` under `pandabox:draft:v1`. Validate with zod.

**Deploy:** build a Sui `Transaction` calling `pandabox::create_project` via `useSignAndExecuteTransaction`. Show a transaction inspector modal pre-sign, listing every Move call + argument in mono. After success → redirect to `/p/[projectId]` with celebratory state (saffron marker on project name, "Project deployed" frame with tx hash).

---

### 6.4 `/p/[projectId]` Project detail

Mood: **clean, dense, data-forward — like opening a project on Aerodrome or Cetus, but with bone palette and diecut geometry instead of dark mode**.

**Hero band (60vh):**
- Cover image: half-width on the right
- Left: eyebrow mono-label (category), H1 project name (`text-5xl md:text-6xl` display), one-line tagline, ticker symbol pill, ProjectAdminCap holder address (truncated, copyable)
- Below name: stat strip, mono, four cells hairline-divided — `RAISED · SUPPORTERS · CYCLE Nº · TIME LEFT`. The `RAISED` figure carries the saffron marker (page's one allowed marker).
- Primary CTA: `Back this project` — large, diecut, ink-fill

**Below the fold — three-column layout:**
- **Left rail (24%):** project metadata. ProjectAdminCap card (small frame element), social links row, contract address (mono + copy), category pill, deployment date, audit pill if applicable
- **Center (48%):** tabbed content. Tabs: `About` · `Cycles` · `Tiers` · `Activity` (mono labels, active carries saffron marker). About tab renders markdown with tight typography, optional first-letter drop cap.
- **Right rail (28%):** the **Pay panel**, sticky. Most important component in the app.

**Pay panel — spec carefully:**
- Header: mono-label `BACK THIS PROJECT`
- Big mono numeric input: amount in SUI, toggle to USD via oracle
- Live preview: `≈ X TOKENS · ≈ Y SUI if cashed out today`
- Tier selector (if project has tiers): horizontal scroll of diecut tier cards. Selected tier shows a subtle saffron marker on its name.
- Optional memo input (max 256 chars) — recorded on-chain in the payment event
- Primary button: `Pay 12 SUI` (diecut, ink-fill). No wallet → swap for ConnectButton.
- Below button: 3-cell mono row showing `RESERVED RATE · CASH-OUT TAX · ISSUANCE REDUCTION` — hairline-divided. Crypto-natives want these visible before paying.

**Below the three columns:**
- **Cycle stepper:** horizontal scroll of cycle cards (past in plum, current in saffron with marker, upcoming in sky). Each card: cycle Nº, dates, raised, payouts, reserved tokens. Click → modal with full cycle record.
- **Activity feed:** dense mono table (§7.6), filtered to this project.
- **Holders table:** top 25 holders ranked, with address, balance, % of supply. Last row: "Others — N addresses — X%".

**Reconfiguration banner:** if a reconfig is queued, sky-bordered frame banner sits above the hero: _"A reconfiguration is queued. Takes effect in 4d 12h. [View changes]"_

---

### 6.5 `/dashboard`

Two sections, hairline-divided: **Your projects** (with quick-reconfig CTA per project) and **Projects you support** (your token balance, cash-out value, last payment).

No wallet → single full-width frame element with ConnectButton + one-line context.

---

### 6.6 `/docs`

Embedded docs. Sidebar nav + main content. Sections: How Pandabox works, Funding cycles, Reserved rate, Cash-out tax, NFT tiers, Ballot delay, Glossary, FAQ. Concise, mono-numeric where relevant, with small "Try it" links into the relevant `/create` step or `/explore` filter.

---

## 7. Component Library

Build as `components/...` with strict prop types. Co-locate variants; promote shared primitives.

### 7.1 Primitives (build first)
- `<Container>`, `<Hairline>` (variants: top/bottom/both/vertical)
- `<MonoLabel>` (semantic wrapper for `.font-mono-label`, optional accent)
- `<AccentRule>` (the 64×4px colored bar above headings, `color` prop)
- `<Marker>` (the highlighter, `color` prop) — max 1 per viewport
- `<Frame>` (the certificate frame) — max 1 per viewport
- `<Diecut>` (the clip-path container) — use freely on CTAs, pills, badges
- `<NoiseLayer>` — absolute-positioned `.noise` overlay component

### 7.2 Identity
- `<Address>` — truncates 8+8 (Sui = 32 bytes), copyable
- `<Identicon>` — generative SVG seeded from address (5×5 mirrored pixel grid in one of the six accents picked from address hash)
- `<TokenAmount>` — formatted with optional ticker
- `<SuiAmount>` — always SUI, with custom 12×12 SUI glyph
- `<RelativeTime>` — `2d 14h ago` / `in 4d`, updates every 30s
- `<TxHash>` — mono-truncated with copy + Sui Explorer link glyph

### 7.3 Project cards
- `<ProjectCard variant="featured">` — 4:3 large card for landing
- `<ProjectCard variant="grid">` — 3-col grid card for `/explore`
- `<ProjectCard variant="row">` — compact horizontal row for `/dashboard`

All variants share a `Project` shape — only layout differs. Grid card pattern:
- Cover image (16:10), `.noise` NOT applied
- Eyebrow mono-label (category, in the project's accent color)
- Project name in `text-xl` sans (not display)
- One-line tagline in ink/70
- Stat strip at bottom: `RAISED · SUPPORTERS · CYCLE Nº`, mono, hairline-divided
- Hover: 2px translateY lift, cover scales 1.02

### 7.4 Cycle UI
- `<CycleStepper>` — horizontal scroll of cycle cards
- `<CycleCard>` — one cycle's frame'd card
- `<CycleClock>` — live "X d Y h left in cycle Nº" counter, mono
- `<ReconfigurationBanner>` — queued-reconfig sky banner
- `<BallotDelayBadge>` — small diecut pill

### 7.5 Pay flow
- `<PayPanel>` — right-rail sticky panel
- `<TierSelector>` — horizontal scroll of NFT tier diecut cards
- `<AmountInput>` — large mono numeric input with SUI/USD toggle
- `<TransactionInspector>` — pre-sign modal listing every Move call + arg, mono
- `<TransactionSuccess>` — post-sign state with tx hash, Sui Explorer link, celebratory marker

### 7.6 Data & feeds
- `<TreasuryPulse variant="hero" | "compact">` — the signature kinetic SVG
- `<ActivityTable>` — dense mono recent-payments table (TIME · PROJECT · PAYER · AMOUNT · MEMO)
- `<SplitFlapCounter>` — character-by-character ticker for changing numbers
- `<TreasuryChart>` — Recharts area chart, ink stroke, saffron fill at 20% opacity, hairline axes
- `<HoldersBar>` — horizontal stacked bar of top-10 + others
- `<SurplusMeter>` — horizontal bar showing payout-limit fill vs surplus

### 7.7 Nav
- `<Nav>` — global top nav with mono-label brand + compact Treasury Pulse in masthead
- `<ConnectButton>` — wraps dApp Kit's ConnectButton, **fully restyled** via the Themes API to match our diecut + ink-fill aesthetic. Read https://sdk.mystenlabs.com/dapp-kit/themes and pass a custom theme object.
- `<Footer>` — three-column with the TECHNICAL column

---

## 8. Data & Indexing Strategy

Sui RPC alone is too slow for listing pages. Plan for an indexer from day one.

**v1 (testnet, no indexer):** read directly via `useSuiClientQuery`. Acceptable while project count is low.

**v1.5 (preparing for mainnet):** lightweight indexer. Options ranked by speed-to-ship:
1. Sui's public GraphQL/gRPC for event filtering by package + module
2. Custom Postgres indexer (Node service subscribing to events, writing to PG, exposing Hono REST)

**Build the frontend assuming a `lib/indexer.ts` module with this surface (mock in v1):**
```ts
listProjects(opts: { sort: SortKey; category?: Category; cursor?: string; limit: number }): Promise<{ items: Project[]; nextCursor?: string }>
getProject(id: string): Promise<Project>
getCycles(projectId: string): Promise<Cycle[]>
getActivity(projectId: string, opts: { limit: number; cursor?: string }): Promise<{ items: Payment[]; nextCursor?: string }>
getHolders(projectId: string): Promise<Holder[]>
getRecentPaymentsGlobal(limit: number): Promise<Payment[]>      // for Treasury Pulse + landing
getGlobalStats(): Promise<{ tvl: bigint; projectCount: number; supporterCount: number; medianCycleDays: number }>
```

---

## 9. Sui-specific UX details

Distinguish a real Sui dapp from a port of an Ethereum one.

- **No gas surprises.** Show gas estimate in the transaction inspector.
- **Object-centric mental model.** The `ProjectAdminCap` is a real object. Render it on `/dashboard` like a Polaroid — generative cover art, mono ID, "Transfer to multisig" link. Make objects tangible.
- **zkLogin friendly.** Support zkLogin via Enoki on the ConnectButton — let users sign in with Google. (Optional v1.5; spec a hook now.)
- **Sui Explorer links everywhere.** Every tx hash, object ID, address links to `https://suiscan.xyz/{network}/...`. Mono external-link glyph next to them.
- **Sponsored transactions** for create flow — sponsor deploy gas to remove "you need SUI before you can create" friction. Spec as stretch goal; build the UI affordance now (small mono note: `gas sponsored by pandabox`).
- **Coin objects ≠ balances.** When paying, split a coin from gas. Surface "spendable SUI" (sum of owned `0x2::sui::SUI` coin objects), not "SUI balance".

---

## 10. Move contract integration

In `lib/contracts/pandabox.ts`, declare typed wrappers for every entry function:

```ts
import { Transaction } from '@mysten/sui/transactions';

export function buildPayTx(args: { projectId: string; amountMist: bigint; memo: string; tierId?: string }) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::pandabox::pay`,
    arguments: [
      tx.object(args.projectId),
      coin,
      tx.pure.string(args.memo),
      args.tierId ? tx.pure.id(args.tierId) : tx.pure.option('id', null),
    ],
  });
  return tx;
}
```

Always split gas explicitly. Always use `tx.pure.<type>(...)` (deprecated to call `tx.pure(...)` directly). Always type entry-function args. Document each wrapper with its Move signature in a JSDoc.

Build wrappers for: `createProject`, `pay`, `cashOut`, `distributePayouts`, `queueReconfiguration`, `claimReservedTokens`, `transferAdminCap`.

---

## 11. Performance & A11y

- **LCP < 1.5s** on Fast 3G for `/` and `/explore`
- Next.js Image for cover art, `priority` on landing's first card only
- Self-host fonts via `next/font` to your CSS vars. `display: swap`. Latin subset.
- Focus-visible ring: 2px saffron, 2px offset — never default blue
- Touch targets ≥ 44×44px
- All mono numerics: `tabular-nums`
- Form errors: `role="alert"`, inputs use `aria-describedby`
- Color contrast: WCAG AA on every accent + ink pairing (ink on saffron passes; white on saffron does not — never use it)
- Reduced motion: respect via globals.css

---

## 12. Project structure

```
pandabox/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                  # landing
│   │   └── docs/[...slug]/page.tsx
│   ├── (app)/
│   │   ├── explore/page.tsx
│   │   ├── create/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── p/[projectId]/
│   │       ├── page.tsx
│   │       ├── cycles/page.tsx
│   │       ├── holders/page.tsx
│   │       └── activity/page.tsx
│   ├── layout.tsx
│   ├── providers.tsx                  # 'use client' boundary
│   ├── globals.css
│   └── icon.tsx
├── components/
│   ├── primitives/
│   ├── identity/
│   ├── project/
│   ├── cycles/
│   ├── pay/
│   ├── data/
│   ├── pulse/                         # the signature Treasury Pulse
│   ├── nav/
│   └── icons/
├── lib/
│   ├── sui.ts
│   ├── contracts/pandabox.ts
│   ├── indexer.ts
│   ├── format.ts
│   ├── store/{wizard,watchlist}.ts
│   └── hooks/
├── types/
├── public/
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 13. Build order (do exactly this)

Bottom-up. Don't start with the landing.

1. **Scaffold:** `npm create next-app@latest pandabox --typescript --tailwind --app --no-src-dir --import-alias "@/*"`. Drop in `globals.css` and `tailwind.config.ts`. Wire fonts via `next/font/google` (Fraunces, Geist Sans, Geist Mono) to the CSS vars.
2. **Providers:** `app/providers.tsx` with dApp Kit. Verify ConnectButton renders.
3. **Primitives:** every component in `components/primitives/`. Build a `/_dev` route rendering all of them for visual regression.
4. **Identity primitives:** `<Address>`, `<Identicon>`, `<TokenAmount>`, `<SuiAmount>`, `<RelativeTime>`, `<TxHash>`. Used everywhere.
5. **Mock the indexer:** `lib/indexer.ts` returns hand-written mocks. Get the frontend looking right before touching the chain.
6. **Build the Treasury Pulse** in isolation on `/_dev`. Get the kinetic right before anything else — it's the soul of the product. Don't ship the landing without it polished.
7. **`/explore`:** grid against mocks. Proves the card pattern works.
8. **`/`:** landing with the polished Pulse front-and-center.
9. **`/p/[projectId]`:** project detail. Build the Pay panel last in this section — most interactive.
10. **`/create`:** wizard. Wire zod + Zustand. The Cycle Simulator is critical.
11. **Wire the chain:** replace mocks with `useSuiClientQuery`. Wire `<PayPanel>` to a real `pay` Move call. Wire deploy to `create_project`.
12. **`/dashboard`** and **`/docs`:** easy once everything else works.
13. **Polish:** page transitions, GSAP enter on cards, focus rings, reduced-motion verification.

Each step → one commit, one-line present-tense message, no emoji.

---

## 14. Things that will trip you up

- **Next 16 + React 19 peer deps:** older libs (especially GSAP-React) may need `--legacy-peer-deps`. Document in `PEER_DEPS_NOTES.md`.
- **`@mysten/dapp-kit-react` requires `@tanstack/react-query` v5+.** Pin compatible versions.
- **CSS import order:** `@mysten/dapp-kit-react/dist/index.css` must come **before** `globals.css` in the layout, or Tailwind reset fights the kit's modal styles.
- **`.noise` is a base64 SVG** in `globals.css` — don't import elsewhere or bundle inflates. Apply via classname only.
- **`tabular-nums` on every mono numeric** — without it, activity table jitters on update.
- **Use `useGSAP` from `@gsap/react`**, never plain `useEffect` — auto-cleans tweens on unmount, essential under React 19 strict mode.
- **`SuiGrpcClient` is client-only.** Don't import from a Server Component. Wrap data-fetching in a `'use client'` hook.
- **Sui addresses are 32 bytes (64 hex).** Truncate 8+8 (`0x12345678…abcdef12`), not Ethereum's 6+4.
- **Coin objects vs balances:** when paying, split from gas. Surface "spendable SUI" (sum of owned coins), not a balance.

---

## 15. Tone & copy

Modern crypto-native voice. Specific, restrained, number-forward. Not editorial, not playful, not breathless.

- "Fund a project." not "🚀 LFG raise to the moon"
- Numbers lead. "1.4 SUI from 0xab…cd · 12m ago" beats "Recent activity"
- Use *project*, not *campaign*. Projects are ongoing.
- Use *supporter*, not *investor*. Avoid securities claims.
- Use *cycle*, not *round*.
- Use *surplus*, not *overflow*. Plain English wins.
- Use *cash out*, not *redeem*.

---

## 16. Definition of done (v1)

- All 9 routes ship, work against testnet
- Create-project wizard deploys a real project
- Pay panel mints tokens, mints tier NFT (if applicable), records memo on-chain
- Cash-out works against a project with surplus
- Reconfiguration queueing works, banner appears
- Treasury Pulse runs smoothly, GPU-composited, no jank, paused offscreen
- LCP < 1.5s on `/` and `/explore` on throttled 3G
- `prefers-reduced-motion` cleanly disables all animation
- Lighthouse a11y ≥ 95 on all routes
- A crypto-native lands on `/`, sees the Pulse, reads the headline, clicks `Explore` in under 6 seconds. Test with 3 crypto-Twitter friends before launch.

---

## 17. The one line you're aiming for

> *"Looks like a Series-A SaaS. Transacts like a Sui-native DEX."*

Modern. Crypto-native. Restrained. One signature kinetic moment that gets it cited. Build for that.

---

**Now go.** Start with step 13.1 and don't skip ahead. The Treasury Pulse is the soul — don't ship the landing without it polished.

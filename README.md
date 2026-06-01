# Pandabox

A fully on-chain funding toolkit for the Sui Network. Pandabox lets anyone launch a fixed-price token sale, bulk-distribute tokens, and run buyback pools without writing a line of Move. Every parameter is set on-chain, every transaction is a Sui programmable transaction block, and every figure shown in the interface is read straight from a fullnode.

The product ships as one Next.js application backed by three independent Move packages, each deployed to Sui mainnet.

```
pandabox-v2.0   →  Next.js 16 frontend (this repository)
pandabox        →  Launchpad: fixed-price token sales
airdrop         →  Single-call bulk token distribution
redeem          →  Fixed-price buyback / redemption pools
```

---

## Why it exists

Most launch tooling on Sui is either a single monolithic dapp or a pile of disconnected scripts. Pandabox treats the three things a token actually needs through its life — a primary sale, a way to get it into holders' hands, and a credible exit — as three small, auditable, single-purpose contracts that share one front end. Each contract is independently upgradeable, holds its own treasury, and exposes its own admin capability. Nothing is coupled beyond the UI.

The design bias throughout is toward determinism and reversibility of trust: fixed pricing instead of opaque curves, one-way reserves instead of rug-pullable vaults, immutable coin metadata frozen at creation, and admin capabilities that can be transferred to a multisig or burned outright.

---

## The three protocols

### Launchpad (`pandabox`)

A time-bounded, fixed-allocation token sale. Pricing is linear and immutable: `raw_tokens = sui_mist × base_rate`. There are no bonding curves and no hidden slippage.

Lifecycle:

1. A creator pre-deploys a `Coin<T>`, ending up with an empty `TreasuryCap<T>` and a `CoinMetadata<T>`.
2. They call `create_project<T>` with the caps, metadata, and sale parameters (base rate, funding allocation, optional end time, unsold-token policy). The `CoinMetadata` is frozen so wallets and explorers can index it, and the caller receives a `ProjectAdminCap<T>`.
3. Supporters call `contribute`, paying SUI and receiving a `ContributionReceipt<T>`. Over-allocation is auto-refunded in the same call, so a buyer never overpays past the remaining supply.
4. The sale closes on its deadline, on sellout (automatically, inside `contribute`), or by admin action. `try_finalize` / `permissionless_finalize` let anyone settle a time-expired sale.
5. Supporters call `claim` or `claim_multiple` to burn receipts and mint their `Coin<T>`.
6. The creator calls `withdraw_sui` to pull raised SUI (the protocol fee is skimmed at withdrawal) and `process_unsold` to either burn the remainder or mint it to themselves.

Every project mints against a fixed total supply of 10,000,000,000 tokens at 9 decimals. The supply invariant is enforced on-chain: in the normal path, user claims plus processed unsold equal the total; in the compromised path, the remainder is forfeited. A `PlatformAdminCap` can pause the platform, adjust the fee (default 500 bps), flag a project as verified, or freeze a malicious sale and route its balance to the treasury.

Modules: `math`, `platform`, `project`, `receipt`.

### Bulk airdrop (`airdrop`)

A single transaction that transfers an arbitrary `Coin<T>` to up to 200 recipients with per-address amounts. Input is validated in full before any transfer happens, so a bad row aborts the whole call with no partial distribution. The caller pays a flat per-recipient fee in SUI (default 0.001 SUI); unused token and fee balances are always returned so the calling PTB has a stable shape. CSVs larger than the recipient cap are chunked into back-to-back calls by the front end.

Modules: `airdrop`, `platform`.

### Redemption pools (`redeem`)

Fixed-price buyback pools. Anyone commits a SUI reserve at a chosen price; anyone else sends `Coin<T>` and receives SUI at that price minus the protocol fee. The price and recipient address are immutable, and the reserve drains one way only — there is no creator withdrawal path, which makes a pool a credible standing bid rather than a vault the operator can empty. Pricing uses a `u128` intermediate against the coin's on-chain decimals to avoid overflow, and the contract exposes `max_redeemable_coin` so the UI can cap inputs to what the reserve can actually pay.

Modules: `pool`, `platform`.

---

## Deployments

All three packages are live on **Sui mainnet** (chain id `35834a8a`).

| Package    | Mainnet package ID                                                   |
|------------|----------------------------------------------------------------------|
| `pandabox` | `0xdb0251d07acc2e39dae2e3daac4f6667841687469dc16d26c2e6f3347da056c8` |
| `airdrop`  | `0x081f0ea255ef1f927fcdb46f5441bd18a7c32e85cbf1aabe5fa5777e8decb55b` |
| `redeem`   | `0xfe5d8f9be6c6d6e5477b74375f353ae246cdc9a20a9274290b75731f8901f4bd` |

The launchpad package is also published on testnet (`0xcc5cba24d6cb1450af2e556a59f9fcb39787446740bf38759c01bc07ac2cd92d`) for staging.

---

## Tech stack

| Layer        | Choice                                                                 |
|--------------|------------------------------------------------------------------------|
| Framework    | Next.js 16 (App Router, React 19, RSC by default)                      |
| Language     | TypeScript, strict                                                     |
| Chain        | `@mysten/dapp-kit` + `@mysten/sui`, gRPC fullnode client               |
| Coin minting | `@mysten/move-bytecode-template` (publishes the creator's `Coin<T>`)   |
| Styling      | Tailwind CSS v3                                                        |
| Motion       | GSAP + `@gsap/react`, Framer Motion, Lenis                             |
| State        | Zustand                                                                |
| Forms        | react-hook-form + zod                                                  |
| Numerics     | bignumber.js (amounts are never plain JS numbers)                     |
| Charts       | Recharts, lightweight-charts                                           |
| i18n         | next-intl, 12 locales                                                  |
| Media        | IPFS via Pinata for uploads; on-chain blob IDs for metadata            |

Contracts are written in Move (edition 2024.beta) and built against the Sui framework that ships with the local CLI.

---

## Getting started

Requirements: Node.js 20+, npm, and a Sui wallet extension. Building or republishing the Move packages additionally needs the [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install).

```bash
git clone <repo-url>
cd pandabox-v2.0
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # serves on http://localhost:3002
```

### Environment

Create `.env.local` in the project root:

```bash
# Network: "mainnet" or "testnet"
NEXT_PUBLIC_SUI_NETWORK=mainnet

# Launchpad
NEXT_PUBLIC_PACKAGE_ID=0xdb0251d07acc2e39dae2e3daac4f6667841687469dc16d26c2e6f3347da056c8
NEXT_PUBLIC_PLATFORM_OBJECT_ID=<shared Platform object id>

# Airdrop
NEXT_PUBLIC_AIRDROP_PACKAGE_ID=0x081f0ea255ef1f927fcdb46f5441bd18a7c32e85cbf1aabe5fa5777e8decb55b
NEXT_PUBLIC_AIRDROP_PLATFORM_ID=<shared AirdropPlatform object id>

# Redeem
NEXT_PUBLIC_REDEEM_PACKAGE_ID=0xfe5d8f9be6c6d6e5477b74375f353ae246cdc9a20a9274290b75731f8901f4bd
NEXT_PUBLIC_REDEEM_PLATFORM_ID=<shared RedeemPlatform object id>

# Media uploads (server-side)
PINATA_JWT=<pinata jwt>
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Each shared `Platform` object is created by its package's `init` function on first publish; read its id from the publish transaction or an explorer. The `*_PLATFORM_ID` values are required for any write path on the corresponding protocol.

### Scripts

```bash
npm run dev        # dev server on port 3002
npm run build      # production build
npm run start      # serve the production build on port 3002
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
```

---

## Project layout

```
app/
  page.tsx              Landing
  explore/              Project discovery
  create/               Token-sale creation wizard
  projects/[projectId]/ Project detail + contribute/claim
  dashboard/            Connected wallet's projects and receipts
  airdrop/              Bulk distribution tool
  redeem/               Pool list, pool detail, pool creation
  tools/                Tool hub
  admin/                Platform admin surfaces
  docs/                 Mechanics and glossary
  api/                  Server routes: uploads, charts, dashboard, pulse, price
components/             UI by domain (project, pay, redeem, airdrop, data, nav, …)
lib/
  contracts/            Typed PTB builders: pandabox.ts, airdrop.ts, redeem.ts
  indexer/  api/        Event reads and aggregation
  store/    hooks/      Client state and data hooks
messages/               12 locale bundles (en, zh-CN, zh-TW, ja, ko, …)
```

The `lib/contracts/*` modules are the single source of truth for how the front end talks to the chain: each entry function has a typed wrapper that builds the programmable transaction block, splits gas explicitly, and documents its Move signature. Import directly from the protocol you need rather than through a barrel, so it stays obvious which package a call touches.

---

## Contract source

The Move sources live in separate repositories alongside this one:

```
pandabox/sources/   math.move  platform.move  project.move  receipt.move
airdrop/sources/    airdrop.move  platform.move
redeem/sources/     pool.move  platform.move
```

To rebuild and run the Move tests for any package:

```bash
cd <package>
sui move build
sui move test
```

Framework and standard-library dependencies are resolved automatically by the CLI to match your local `sui` binary; they are intentionally not pinned in `Move.toml` to avoid verifier drift between the framework HEAD and the toolchain.

---

## Status

Built for a hackathon. The contracts are deployed and exercised on mainnet; the front end is the reference client for all three. The launchpad uses a fixed-price model by design — simple to reason about, cheap to verify, and hard to game.

## License

MIT.

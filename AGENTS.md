# Agent Instructions for Pandabox

This file distills `claude.md` into day-to-day operating rules for coding agents in this repository. Read `claude.md` before major product, design, architecture, or Sui integration work; it remains the full build brief.

## Current Repo Reality

- This repository is the Next.js frontend for Pandabox on Sui.
- The live codebase includes launchpad, airdrop, redeem, dashboard, admin, docs, and tool-hub surfaces.
- `claude.md` is the product/design north star. If it conflicts with existing shipped behavior, preserve the current implementation unless the task explicitly asks for a migration.
- Do not invent new protocol mechanics without checking the current Move-facing wrappers in `lib/contracts/`, the data readers in `lib/`, and the relevant UI flow.

## Product North Star

Pandabox should feel like a precision-engineered Sui-native funding product: restrained, data-forward, and credible to crypto-native users.

Aim for:

- Crypto-native confidence: real addresses, object IDs, transaction hashes, package IDs, cycle status, and amounts are first-class UI.
- Engineered restraint: hairlines, strong type hierarchy, dense but calm data, and no decorative noise outside approved surfaces.
- Quiet personality: panda identity, diecut geometry, marker highlights, and accent colors used sparingly.

Avoid:

- Generic web3 chrome: gradient buttons, glassmorphism, neon glows, dark-mode-first styling.
- Casino or meme-launch copy: no rocket/LFG/moon language.
- SaaS-template visuals: no anonymous white cards, generic feature grids, soft shadow piles, or decorative blobs.
- Ethereum assumptions: Sui addresses, object ownership, coin objects, and programmable transaction blocks must be handled correctly.

## Stack and Commands

- Framework: Next.js 16 App Router with React 19.
- Language: TypeScript strict.
- Styling: Tailwind CSS v3 plus `app/globals.css`.
- Wallet/chain: Mysten Sui SDK and dApp Kit. Check the installed package names and existing provider setup before changing imports.
- State/forms: Zustand, react-hook-form, zod.
- Motion: GSAP with `@gsap/react` for GSAP work, Framer Motion for component interactions.
- Numerics: never use plain JavaScript numbers for token or SUI amounts; use bigint, Sui MIST helpers, or the existing amount utilities.

Useful commands:

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
git diff --check
```

Run the smallest relevant checks for the change. For docs-only edits, at minimum run `git diff --check`.

## Design Rules

- v1 is light-mode-first. Do not add dark mode unless explicitly requested.
- Use the bone/paper surface and ink text as the default visual foundation.
- Hairlines are the primary structure: use 1px ink borders/dividers instead of shadows.
- Diecut geometry is the signature shape for primary CTAs, important pills, badges, selected tiers, and signature frames.
- Use `.frame` sparingly for certificate-like moments such as admin caps, queued reconfiguration confirmations, or success states. Keep it rare.
- Use marker highlights as punctuation. Maximum one marker per viewport.
- Treat accent colors as semantic tokens, not decoration:
  - Saffron: default accent, active, in progress.
  - Poppy: inflow, treasury balance, warnings.
  - Jade: community, token holders, supporters.
  - Sky: governance, reconfiguration, ballot delay.
  - Sun: surplus, payouts, distributions, cash-out value.
  - Plum: history, closed cycles, archive.
- Typography should be restrained:
  - Display font only for major H1s and a few pull-number moments.
  - Sans for structure and UI.
  - Mono for addresses, hashes, amounts, percentages, cycle numbers, timestamps, labels, and tabular data.
- All numeric UI must use tabular numerals.
- Sui addresses should be truncated 8+8, for example `0x12345678...abcdef12`, not Ethereum-style 6+4.
- Respect `prefers-reduced-motion` for every animation.
- Touch targets must be at least 44x44px.

## Treasury Pulse

The Treasury Pulse is the signature kinetic moment described in `claude.md`.

- It visualizes live Pandabox treasury/payment flow as a restrained SVG pulse, not a decorative chart.
- Landing-page variant should feel central and polished; compact variants can appear in navigation, filters, or mastheads.
- New events should create subtle hairline motion, ticks, and mono counter updates.
- Larger payments may produce taller peaks, with category or protocol color mapped through semantic accents.
- It must pause offscreen and degrade cleanly for reduced motion.
- Do not ship major landing-page work that sidelines or weakens this component.

## Sui and Transaction Rules

- Every write path should go through a typed programmable transaction builder in `lib/contracts/`.
- Document Move signatures near wrapper functions when adding or changing transaction builders.
- Split gas explicitly where the transaction sends SUI or other coins.
- Use typed pure values such as `tx.pure.string(...)`, `tx.pure.u64(...)`, or the existing repo pattern. Do not add deprecated untyped `tx.pure(...)` calls.
- Show gas estimates or transaction details before signing when the flow is user-facing.
- Treat `ProjectAdminCap` and other admin caps as real Sui objects, not just permissions hidden in state.
- Link transaction hashes, object IDs, package IDs, and addresses to a Sui explorer where the surrounding UI already supports it.
- Remember that coin objects are not the same thing as balances. Spendable SUI is assembled from owned coin objects.

## Data and Architecture

- Server-render everything that does not need wallet state.
- Keep wallet providers and Sui client hooks inside explicit client boundaries.
- Listing and dashboard surfaces should use the existing data/indexer modules rather than ad hoc RPC calls from components.
- Keep protocol-specific logic separated: launchpad, airdrop, redeem, admin, and dashboard modules should stay easy to reason about.
- Prefer existing primitives in `components/primitives/`, identity components in `components/identity/`, and protocol-specific components under their current folders.
- Do not create broad barrels or generic abstractions unless they remove real duplication and match local patterns.

## Build Order for Large Features

For substantial work, build bottom-up:

1. Confirm the current route, data shape, and existing components.
2. Add or update primitives and identity helpers first.
3. Wire mock or fixture-backed data before live chain reads where useful.
4. Build isolated interactive components before page composition.
5. Compose the route.
6. Wire transaction builders and wallet flows.
7. Add focused tests or verification for the touched behavior.
8. Run checks and inspect the rendered result for UI work.

Do not start with a polished landing section when the primitives, data, or core interaction are missing.

## Copy Rules

- Use "project", not "campaign".
- Use "supporter", not "investor".
- Use "cycle", not "round".
- Use "surplus", not "overflow".
- Use "cash out", not "redeem", when describing supporter exits from launchpad surplus.
- Keep copy specific, restrained, and number-forward.

## Verification and Git Hygiene

- Check `git status --short --branch` before editing.
- Do not revert unrelated user changes.
- Keep commits scoped to the requested work.
- For docs-only edits, run `git diff --check` before committing.
- For code changes, run the relevant lint, typecheck, tests, build, or rendered UI verification needed to prove the change.
- When the user asks to commit and push, finish the full flow: stage the intended files, commit, push, then verify upstream sync with `git rev-list --left-right --count @{u}...HEAD`.

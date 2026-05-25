import { z } from "zod";

export const CATEGORY = z.enum([
  "opc",
  "art",
  "infra",
  "dao",
  "research",
  "gaming",
  "music",
  "social",
  "rwa",
  "meme",
]);

/* ───────────────────────── Step 1 — Identity ───────────────────────── */
/**
 * Off-chain metadata for the project page. `name` goes on-chain (arg3 of
 * create_project). Tagline + category + socials are pinned together as a
 * single project_details JSON blob (arg7). Description (markdown) is pinned
 * standalone as description_blob_id (arg4). Cover image gateway URL is
 * icon_url (arg5).
 */
export const StepIdentity = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  /** Display ticker. Informational — the real symbol comes from CoinMetadata. */
  ticker: z
    .string()
    .trim()
    .min(2, "Ticker is too short")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z][A-Z0-9]*$/, "Uppercase letters and digits only"),
  tagline: z.string().trim().min(8, "Add a short tagline").max(160),
  category: CATEGORY,
  description: z.string().trim().min(20, "Add a real description").max(4000),
  /** Gateway URL for the cover image (== icon_url on-chain). */
  coverImage: z.string().trim().min(1, "Add a cover image"),
  /** CID of the pinned cover image. */
  coverImageCid: z.string().trim().optional().or(z.literal("")),
  twitter: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(120).optional().or(z.literal("")),
  discord: z.string().trim().max(120).optional().or(z.literal("")),
});

/* ───────────────────────── Step 2 — Coin ───────────────────────── */
/**
 * The project coin must already exist on-chain. Creator pre-publishes a
 * Coin module and ends up owning `TreasuryCap<T>` + `CoinMetadata<T>`.
 * Pandabox's `create_project` requires both — they're consumed and locked
 * inside the Project object.
 *
 * Protocol-required decimals = 9 (verified on-chain). We surface the coin's
 * metadata once an ID is pasted so the creator can double-check.
 */
const HEX_ID = /^0x[0-9a-fA-F]{1,64}$/;
const COIN_TYPE = /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/;

export const StepCoin = z.object({
  /** Fully-qualified Move type, e.g. "0xabc…::mycoin::MYCOIN". */
  coinType: z
    .string()
    .trim()
    .regex(COIN_TYPE, "Use a fully-qualified coin type like 0x…::module::NAME"),
  treasuryCapId: z
    .string()
    .trim()
    .regex(HEX_ID, "Use a Sui object ID"),
  coinMetadataId: z
    .string()
    .trim()
    .regex(HEX_ID, "Use a Sui object ID"),
  /** Read from chain — informational. */
  coinName: z.string().trim().optional().or(z.literal("")),
  coinSymbol: z.string().trim().optional().or(z.literal("")),
  coinDecimals: z.number().int().optional(),
  /** Set true once we've confirmed the coin metadata matches the cap. */
  verified: z.boolean(),
});

/* ───────────────────────── Step 3 — Sale terms ───────────────────────── */

export const UNSOLD_ACTIONS = ["burn", "transfer_to_creator"] as const;
export type UnsoldActionKey = (typeof UNSOLD_ACTIONS)[number];

/**
 * The four sale params that go directly into `create_project`. All bigint
 * fields are entered as decimal strings in the UI (tokens / SUI / etc.)
 * and converted at submission time:
 *
 *   - `tokensPerSui` ("100") → base_rate scaled to 9 decimals
 *   - `allocationTokens` ("1000000") → funding_allocation scaled to 9 decimals
 *   - `endTimeMs` is a unix ms or null (no time cap)
 *   - `unsoldAction` 0|1 maps to UnsoldAction constants
 */
export const StepSale = z.object({
  /** Whole tokens issued per 1 SUI of contribution. Stored as string. */
  tokensPerSui: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Use a positive number"),
  /** Total tokens to sell over the sale window. Stored as string. */
  allocationTokens: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Use a positive number"),
  /** Sale end time in unix ms. null = no time cap (admin-closed only). */
  endTimeMs: z.number().int().nullable(),
  unsoldAction: z.enum(UNSOLD_ACTIONS),
});

/* ───────────────────────── Step 4 — Deploy ───────────────────────── */
/**
 * Optional source-code blob pinned ahead of deploy. Always submittable — if
 * the creator skips it, an empty string goes on-chain and they can
 * `update_metadata` later.
 */
export const StepDeploy = z.object({
  sourceCodeBlobId: z.string().trim().optional().or(z.literal("")),
});

/* ───────────────────────── Full draft ───────────────────────── */

export const Draft = z.object({
  version: z.literal(2),
  step: z.number().int().min(1).max(4),
  identity: StepIdentity.partial(),
  coin: StepCoin.partial(),
  sale: StepSale.partial(),
  deploy: StepDeploy.partial(),
});

export type DraftV2 = z.infer<typeof Draft>;
export type IdentityV = z.infer<typeof StepIdentity>;
export type CoinV = z.infer<typeof StepCoin>;
export type SaleV = z.infer<typeof StepSale>;
export type DeployV = z.infer<typeof StepDeploy>;

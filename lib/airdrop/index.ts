/**
 * Client-safe surface of the Airdrop tool's data layer.
 *
 * Server-only readers (`reader.ts`, `events.ts`) and the cached server-action
 * wrappers are intentionally NOT re-exported here — they live under
 * `@/lib/airdrop/server` so accidentally importing them from a client
 * component fails loudly rather than at runtime (same convention as
 * `@/lib/redeem`).
 */

export * from "./types";
export * from "./abort-codes";
export * from "./parse-recipients";
export * from "./quote";
export * from "./coin-discovery";
export * from "./batching";
export * from "./submit-state";
export * from "./wire";

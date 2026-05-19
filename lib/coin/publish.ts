"use client";

import { bcs } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import {
  COIN_TEMPLATE_BYTECODE_BASE64,
  COIN_TEMPLATE_DEFAULTS,
} from "./bytecode-template";

/**
 * Guided coin publish — rewrites a pre-compiled coin module's identifiers and
 * b"..." constants client-side via @mysten/move-bytecode-template, then builds
 * a publish transaction. After execution, `parsePublishedCoin` pulls the new
 * package ID + TreasuryCap + CoinMetadata from the transaction's effects +
 * objectTypes map.
 *
 * Why this exists: Pandabox's `project::create_project<T>` requires the
 * caller to own a TreasuryCap<T> + CoinMetadata<T>. Forcing creators to run
 * `sui client publish` from a CLI before opening the wizard is a UX wall —
 * this lets them stay in the browser.
 */

export type CoinFormParams = {
  /** snake_case module name. Must start with a letter, ASCII identifier. */
  moduleName: string;
  /** UPPER_SNAKE_CASE witness struct. By convention == moduleName.toUpperCase(). */
  witnessName: string;
  /** Display symbol surfaced in wallets / explorers. */
  symbol: string;
  /** Display name. */
  name: string;
  /** Free-form text (or URL) stored as `description` in CoinMetadata. */
  description: string;
  /** Icon URL stored in CoinMetadata. Must be UTF-8 / ASCII. */
  iconUrl: string;
};

let wasmInitPromise: Promise<typeof import("@mysten/move-bytecode-template")> | null = null;

/**
 * Lazy-load the WASM module once. The web build of @mysten/move-bytecode-template
 * needs an explicit init() call before any function runs. We resolve the
 * `.wasm` URL relative to the package via `import.meta.url` (Turbopack /
 * webpack 5 both emit the asset and rewrite the URL).
 */
async function getTemplate() {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const mod = await import("@mysten/move-bytecode-template");
      // The package's `browser` export points at the wasm-pack web bundle,
      // whose default export is the init function. In Node test envs it's a
      // no-op. Either way, calling once is safe.
      const init = (mod as { default?: (opts?: unknown) => Promise<unknown> | void }).default;
      if (typeof init === "function") {
        await init();
      }
      return mod;
    })();
  }
  return wasmInitPromise;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Rewrite the coin template bytecode with the user's identifiers + metadata.
 * Returns the modified module bytes ready to feed into `tx.publish`.
 */
export async function rewriteCoinBytecode(
  params: CoinFormParams,
): Promise<Uint8Array> {
  const template = await getTemplate();
  let bytecode = base64ToBytes(COIN_TEMPLATE_BYTECODE_BASE64);

  // 1. Swap identifiers (module + witness struct).
  bytecode = template.update_identifiers(bytecode, {
    [COIN_TEMPLATE_DEFAULTS.moduleName]: params.moduleName,
    [COIN_TEMPLATE_DEFAULTS.witnessName]: params.witnessName,
  });

  // 2. Swap the four `b"..."` byte-string constants in the constant pool.
  const enc = (s: string) =>
    bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(s)).toBytes();

  const swaps: Array<{ from: string; to: string; label: string }> = [
    { from: COIN_TEMPLATE_DEFAULTS.symbol, to: params.symbol, label: "symbol" },
    { from: COIN_TEMPLATE_DEFAULTS.name, to: params.name, label: "name" },
    {
      from: COIN_TEMPLATE_DEFAULTS.description,
      to: params.description,
      label: "description",
    },
    {
      from: COIN_TEMPLATE_DEFAULTS.iconUrl,
      to: params.iconUrl,
      label: "iconUrl",
    },
  ];

  for (const s of swaps) {
    const oldBcs = enc(s.from);
    const newBcs = enc(s.to);
    if (bytesEqual(oldBcs, newBcs)) continue;
    bytecode = template.update_constants(bytecode, newBcs, oldBcs, "Vector(U8)");
  }

  return bytecode;
}

/**
 * Build a single-module `tx.publish` for the rewritten coin bytecode.
 * The transaction's UpgradeCap is transferred to the sender.
 *
 * Dependencies are Sui framework (0x1 + 0x2) — matches what
 * `sui move build` emits for the template.
 */
export function buildPublishCoinTx(args: {
  bytecode: Uint8Array;
  sender: string;
}): Transaction {
  const tx = new Transaction();
  const upgradeCap = tx.publish({
    modules: [Array.from(args.bytecode)],
    dependencies: [
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    ],
  });
  tx.transferObjects([upgradeCap], args.sender);
  return tx;
}

export type PublishedCoinResult = {
  /** New package address. */
  packageId: string;
  /** "0xabc::module::WITNESS" — what create_project's typeArguments wants. */
  coinType: string;
  treasuryCapId: string;
  coinMetadataId: string;
  upgradeCapId?: string;
};

import type { SuiJsonRpcClient, SuiObjectChange } from "@mysten/sui/jsonRpc";

/**
 * Error thrown when the publish tx confirmed on-chain but the fullnode
 * returned an empty `objectChanges` array (despite us asking for it). The
 * package, TreasuryCap, and CoinMetadata exist — the caller can recover by
 * pasting the IDs into the "I already have a coin" mode. We carry the
 * transaction digest so the UI can deep-link to Sui Explorer.
 */
export class MissingObjectChangesError extends Error {
  digest: string;
  constructor(digest: string) {
    super(
      "Your coin published successfully on-chain, but the Sui RPC didn't " +
        "return the new object IDs in time. Open the transaction on Sui " +
        "Explorer to grab the package ID, TreasuryCap, and CoinMetadata, " +
        "then switch to 'I already have a coin' and paste them in.",
    );
    this.name = "MissingObjectChangesError";
    this.digest = digest;
  }
}

/**
 * Pull the new package ID + Coin objects out of a publish tx's
 * `objectChanges`. The publish creates one of each: a `published` change for
 * the new package, `TreasuryCap<T>` (created, owned by sender),
 * `CoinMetadata<T>` (created, frozen), `UpgradeCap` (created, owned by sender).
 */
export function parsePublishedCoin(
  changes: SuiObjectChange[] | null | undefined,
  digest?: string,
): PublishedCoinResult {
  if (!changes || changes.length === 0) {
    throw new MissingObjectChangesError(digest ?? "");
  }

  let packageId: string | null = null;
  let treasuryCapId: string | null = null;
  let treasuryCapType: string | null = null;
  let coinMetadataId: string | null = null;
  let upgradeCapId: string | undefined;

  for (const c of changes) {
    if (c.type === "published") {
      packageId = c.packageId;
      continue;
    }
    if (c.type !== "created") continue;
    const t = c.objectType ?? "";
    if (/^0x2::coin::TreasuryCap</.test(t)) {
      treasuryCapId = c.objectId;
      treasuryCapType = t;
    } else if (/^0x2::coin::CoinMetadata</.test(t)) {
      coinMetadataId = c.objectId;
    } else if (/^0x2::package::UpgradeCap$/.test(t)) {
      upgradeCapId = c.objectId;
    }
  }

  if (!packageId || !treasuryCapId || !coinMetadataId || !treasuryCapType) {
    throw new Error(
      `Could not locate published coin objects (package=${packageId ?? "?"}, treasuryCap=${treasuryCapId ?? "?"}, metadata=${coinMetadataId ?? "?"}).`,
    );
  }

  // "0x2::coin::TreasuryCap<0xabc::mod::WIT>" → "0xabc::mod::WIT"
  const m = treasuryCapType.match(/TreasuryCap<(.+)>$/);
  const coinType = m?.[1];
  if (!coinType) {
    throw new Error(
      `Could not parse coin type from TreasuryCap object type: ${treasuryCapType}`,
    );
  }

  return {
    packageId,
    coinType,
    treasuryCapId,
    coinMetadataId,
    upgradeCapId,
  };
}

/**
 * After the wallet returns a digest, wait for the tx to be indexed and fetch
 * its `objectChanges`. Uses the legacy `SuiJsonRpcClient` shape since that's
 * what dapp-kit's `useSuiClient` resolves to in this project.
 *
 * Some fullnodes confirm the tx (status: success) before they finish indexing
 * object changes, returning an empty `objectChanges` array. When that happens
 * we re-fetch `getTransactionBlock` with backoff up to ~8s before giving up —
 * usually the index catches up within 1–2 polls.
 */
export async function fetchPublishResult(
  client: SuiJsonRpcClient,
  digest: string,
): Promise<{ objectChanges: SuiObjectChange[] | null | undefined }> {
  const res = await client.waitForTransaction({
    digest,
    options: { showEffects: true, showObjectChanges: true },
  });
  if (!res.effects || res.effects.status?.status !== "success") {
    throw new Error(
      res.effects?.status?.error ?? "Publish transaction failed on chain.",
    );
  }

  if (res.objectChanges && res.objectChanges.length > 0) {
    return { objectChanges: res.objectChanges };
  }

  // Empty objectChanges despite success — fullnode hasn't indexed yet. Poll.
  const delays = [500, 800, 1200, 1800, 2600];
  for (const ms of delays) {
    await new Promise((r) => setTimeout(r, ms));
    try {
      const retry = await client.getTransactionBlock({
        digest,
        options: { showEffects: true, showObjectChanges: true },
      });
      if (retry.objectChanges && retry.objectChanges.length > 0) {
        return { objectChanges: retry.objectChanges };
      }
    } catch {
      // transient — keep polling
    }
  }

  return { objectChanges: res.objectChanges };
}

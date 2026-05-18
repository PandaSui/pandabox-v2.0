// Move source template for a project-issued coin. We render it client-side
// with the user's chosen identifiers / metadata, then pin the rendered text to
// IPFS so the on-chain `source_code_blob_id` field points to a human-readable
// version of exactly what was published to chain.
//
// Identifiers / constants must stay in sync with `coin-template/sources/coin_template.move`
// — the same template that `@mysten/move-bytecode-template` rewrites at the
// bytecode level. The strings here are for source readability only; they do
// not affect what is actually published.

export type CoinSourceParams = {
  moduleName: string; // snake_case, e.g. "panda"
  witnessName: string; // UPPER_SNAKE_CASE, e.g. "PANDA"
  symbol: string; // e.g. "PANDA"
  name: string; // e.g. "Panda Test"
  description: string; // text or URL stored in CoinMetadata
  iconUrl: string; // URL stored in CoinMetadata
};

/**
 * Render the coin module source with the user's chosen identifiers and metadata
 * substituted in. The result is exactly what the published bytecode encodes —
 * useful as an audit artifact for users browsing project details.
 */
export function renderCoinSource(params: CoinSourceParams): string {
  // Escape any backslash/quote that would break the b"..." literal. Move byte
  // strings accept ASCII; we only need to defang `\` and `"`.
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `/*
 *           .--.            .--.
 *          (    )----------(    )
 *           \\             /
 *            |   O      O   |
 *            |       v      |
 *            |     '---'    |
 *             \\            /
 *              '----------'
 *               P A N D A B O X
 */
#[allow(deprecated_usage)]
module ${params.moduleName}::${params.moduleName};

use sui::coin;
use sui::url;

public struct ${params.witnessName} has drop {}

fun init(witness: ${params.witnessName}, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency<${params.witnessName}>(
        witness,
        9,
        b"${esc(params.symbol)}",
        b"${esc(params.name)}",
        b"${esc(params.description)}",
        option::some(url::new_unsafe_from_bytes(b"${esc(params.iconUrl)}")),
        ctx,
    );
    transfer::public_transfer(treasury_cap, ctx.sender());
    transfer::public_transfer(metadata, ctx.sender());
}
`;
}

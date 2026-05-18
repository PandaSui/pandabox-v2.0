// Pre-compiled bytecode of coin-template/sources/coin_template.move.
// Identifiers and metadata constants will be rewritten at runtime via
// @mysten/move-bytecode-template before publish.
//
// Defaults baked in:
//   module      coin_template::coin_template
//   witness     COIN_TEMPLATE
//   symbol      "TMPL"
//   name        "Template"
//   description "Template description"
//   icon URL    "https://placeholder.com/icon.png"
//
// Regenerate when coin-template/sources/coin_template.move changes:
//   cd coin-template && sui move build && \
//     base64 -i build/coin_template/bytecode_modules/coin_template.mv

export const COIN_TEMPLATE_BYTECODE_BASE64 =
  "oRzrCwcAAAUKAQAMAgweAyohBEsIBVNMB58BwQEI4AJgBsADUAqQBAUMlQQuAAcBDAIGAhACEQISAAACAAECBwEAAAIBDAEAAQIDDAEAAQQEAgAFBQcAAAoAAQABDwUGAQACCAgJAQIDDQ0BAQwEDgoLAAULAwQAAQQCBwMMAwICCAAHCAQAAQsCAQgAAQoCAQgFAQkAAQsBAQkAAQgABwkAAgoCCgIKAgsBAQgFBwgEAgsDAQkACwIBCQABBggEAQUBCwMBCAACCQAFDUNPSU5fVEVNUExBVEUMQ29pbk1ldGFkYXRhBk9wdGlvbgtUcmVhc3VyeUNhcAlUeENvbnRleHQDVXJsBGNvaW4NY29pbl90ZW1wbGF0ZQ9jcmVhdGVfY3VycmVuY3kLZHVtbXlfZmllbGQEaW5pdBVuZXdfdW5zYWZlX2Zyb21fYnl0ZXMGb3B0aW9uD3B1YmxpY190cmFuc2ZlcgZzZW5kZXIEc29tZQh0cmFuc2Zlcgp0eF9jb250ZXh0A3VybAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgoCBQRUTVBMCgIJCFRlbXBsYXRlCgIVFFRlbXBsYXRlIGRlc2NyaXB0aW9uCgIhIGh0dHBzOi8vcGxhY2Vob2xkZXIuY29tL2ljb24ucG5nAAIBCQEAAAAAAhULADEJBwAHAQcCBwMRBTgACgE4AQwCCgEuEQQ4AgsCCwEuEQQ4AwIAAA==";

// Default constants encoded in the template. Required when calling
// @mysten/move-bytecode-template's `update_constants` since it identifies a
// constant by its existing value, not by an index.
export const COIN_TEMPLATE_DEFAULTS = {
  moduleName: "coin_template",
  witnessName: "COIN_TEMPLATE",
  symbol: "TMPL",
  name: "Template",
  description: "Template description",
  iconUrl: "https://placeholder.com/icon.png",
} as const;

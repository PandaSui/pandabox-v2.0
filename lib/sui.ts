import BigNumber from "bignumber.js";

export type SuiNetwork = "mainnet" | "testnet" | "devnet";

export const MIST_PER_SUI = 1_000_000_000n;
export const SUI_DECIMALS = 9;

export function getNetwork(): SuiNetwork {
  const n = process.env.NEXT_PUBLIC_SUI_NETWORK;
  if (n === "testnet" || n === "devnet") return n;
  return "mainnet";
}

export function explorerUrl(
  kind: "tx" | "object" | "address",
  id: string,
  network: SuiNetwork = getNetwork(),
): string {
  const seg = kind === "tx" ? "tx" : kind === "object" ? "object" : "account";
  return `https://suiscan.xyz/${network}/${seg}/${id}`;
}

export function mistToSui(mist: bigint | string): BigNumber {
  return new BigNumber(mist.toString()).dividedBy(MIST_PER_SUI.toString());
}

export function rawToDecimal(
  raw: bigint | string,
  decimals: number,
): BigNumber {
  return new BigNumber(raw.toString()).shiftedBy(-decimals);
}

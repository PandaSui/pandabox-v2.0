import { apiFetch } from "@pandasui/ui/lib";

export type Coin = {
  id: number;
  coin_contract: string;
  coin_name: string;
  coin_symbol: string;
  coin_holders: number;
  coin_supply: number;
  coin_logo: string;
  createTimestamp: number;
  price: number;
  fdv: number;
};

export function getCoins(signal?: AbortSignal): Promise<Coin[]> {
  return apiFetch<Coin[]>("/coin", { signal });
}

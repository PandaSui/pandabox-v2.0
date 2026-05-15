import { useQuery } from "@tanstack/react-query";
import { getCoins, type Coin } from "@/lib/endpoints/coins";

export function useCoins(options: { enabled?: boolean } = {}) {
  return useQuery<Coin[]>({
    queryKey: ["coins"],
    queryFn: ({ signal }) => getCoins(signal),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

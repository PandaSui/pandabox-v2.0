import type { Accent } from "@/types/pandabox";

export type PulseEventDTO = {
  txHash: string;
  projectId: string;
  projectName: string;
  projectAccent: Accent;
  payer: string;
  amountMist: string;
  timestamp: number;
};

export type PulseSnapshot = {
  events: PulseEventDTO[];
  tvlMist: string;
  fetchedAt: number;
};

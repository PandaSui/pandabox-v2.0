import type { SupportEntry } from "@/lib/indexer/dashboard";
import {
  toPaymentDTO,
  toProjectDTO,
  type PaymentDTO,
  type ProjectDTO,
} from "./project-dto";

export type SupportEntryDTO = {
  project: ProjectDTO;
  balanceRaw: string;
  pctSupply: number;
  cashOutMist: string;
  lastPayment: PaymentDTO | null;
};

export type DashboardDTO = {
  address: string;
  owned: ProjectDTO[];
  supported: SupportEntryDTO[];
};

export function toSupportEntryDTO(e: SupportEntry): SupportEntryDTO {
  return {
    project: toProjectDTO(e.project),
    balanceRaw: e.balanceRaw.toString(),
    pctSupply: e.pctSupply,
    cashOutMist: e.cashOutMist.toString(),
    lastPayment: e.lastPayment ? toPaymentDTO(e.lastPayment) : null,
  };
}

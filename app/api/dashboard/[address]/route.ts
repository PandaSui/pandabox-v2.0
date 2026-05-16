import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/indexer/dashboard";
import { toProjectDTO } from "@/lib/api/project-dto";
import {
  toSupportEntryDTO,
  type DashboardDTO,
} from "@/lib/api/dashboard-dto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const { address } = await context.params;
  const data = await getDashboard(address);
  const payload: DashboardDTO = {
    address,
    owned: data.owned.map(toProjectDTO),
    supported: data.supported.map(toSupportEntryDTO),
  };
  return NextResponse.json(payload);
}

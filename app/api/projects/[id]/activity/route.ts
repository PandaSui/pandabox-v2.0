import { NextResponse } from "next/server";
import { getActivity } from "@/lib/indexer";
import {
  toPaymentDTO,
  type ActivityListDTO,
} from "@/lib/api/project-dto";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") ?? "25")),
  );

  const result = await getActivity(id, { cursor, limit });
  const payload: ActivityListDTO = {
    items: result.items.map(toPaymentDTO),
    nextCursor: result.nextCursor,
  };
  return NextResponse.json(payload);
}

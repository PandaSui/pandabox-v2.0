/**
 * Wire shapes for shipping `Airdropped` events across the server-action
 * boundary. `JSON.stringify` and Next 16's server-action serializer both
 * reject bare `bigint`, so amounts ride as decimal strings and the
 * client lifts back to `bigint` after the await.
 *
 * Same pattern as `lib/airdrop/reader.ts` — keep the wire type private
 * to the boundary, never let it leak into UI code.
 */

import type { AirdroppedEvent } from "./types";

export type AirdroppedEventWire = Omit<
  AirdroppedEvent,
  "totalAmountRaw" | "feeMist"
> & {
  totalAmountRaw: string;
  feeMist: string;
};

export function toWire(e: AirdroppedEvent): AirdroppedEventWire {
  return {
    ...e,
    totalAmountRaw: e.totalAmountRaw.toString(),
    feeMist: e.feeMist.toString(),
  };
}

export function fromWire(w: AirdroppedEventWire): AirdroppedEvent {
  return {
    ...w,
    totalAmountRaw: BigInt(w.totalAmountRaw),
    feeMist: BigInt(w.feeMist),
  };
}

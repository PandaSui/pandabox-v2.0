"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { WithdrawSuccess } from "@/components/project/admin-panel";

// Realistic mock data — long hex addresses + a base58-ish digest so the
// truncation logic + Suiscan link both render exactly as they will in prod.
const FIXTURE = {
  amountMist: 142_584_310_000n, // 142.5843 SUI
  digest: "22ULN9Trz4uYx1KHNPetKfSt7U2XY6ttNEjmqDGRTwML",
  recipient:
    "0xa5fd521610eaba7a65601f79fe5b898a7eef83f94cf2019900df6c512df5e5c1",
  capId:
    "0xb77234c597bcd58a32ef0e1f4a8b2d9c5e6f7a89b0c1d2e3f4a5b6c7d8e9f7db2",
};

// Quick toggles let the user preview the modal at several treasury sizes,
// since the display number's scale carries a lot of the modal's read.
const PRESETS = [
  { label: "1.4 SUI", amount: 1_400_000_000n },
  { label: "142.58 SUI", amount: 142_584_310_000n },
  { label: "10K SUI", amount: 10_000_000_000_000n },
  { label: "0.0001 SUI", amount: 100_000n },
];

// Common protocol fee values plus a "loading" sentinel so we can also preview
// the fallback copy when the on-chain read hasn't resolved yet.
const FEE_PRESETS: { label: string; bps: number | null }[] = [
  { label: "loading", bps: null },
  { label: "0%", bps: 0 },
  { label: "2.5%", bps: 250 },
  { label: "5%", bps: 500 },
  { label: "10%", bps: 1000 },
];

export default function WithdrawSuccessPreview() {
  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState<bigint>(FIXTURE.amountMist);
  const [hasRecipient, setHasRecipient] = useState(true);
  const [feeBps, setFeeBps] = useState<number | null>(500);

  return (
    <main className="min-h-screen bg-bone p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono-label text-[11px] text-ink/70">
          dev · withdraw-success preview
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const active = amount === p.amount;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setAmount(p.amount)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 items-center border px-2.5 font-mono-label text-[10px] transition-colors",
                  active
                    ? "border-ink bg-ink text-bone"
                    : "border-ink/25 text-ink/70 hover:border-ink hover:text-ink",
                )}
              >
                {p.label}
              </button>
            );
          })}
          <span aria-hidden className="text-ink/15">
            ·
          </span>
          {/* Fee-bps presets — drives the receipt's fee + net rows. The
              `loading` preset (null) simulates the on-chain read in flight
              and lets us preview the placeholder fallback copy. */}
          {FEE_PRESETS.map((f) => {
            const active = feeBps === f.bps;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFeeBps(f.bps)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 items-center border px-2.5 font-mono-label text-[10px] transition-colors",
                  active
                    ? "border-poppy bg-poppy/15 text-poppy"
                    : "border-ink/25 text-ink/70 hover:border-ink hover:text-ink",
                )}
              >
                fee · {f.label}
              </button>
            );
          })}
          <span aria-hidden className="text-ink/15">
            ·
          </span>
          <button
            type="button"
            onClick={() => setHasRecipient((v) => !v)}
            aria-pressed={hasRecipient}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 border px-2.5 font-mono-label text-[10px] transition-colors",
              hasRecipient
                ? "border-jade bg-jade/10 text-jade"
                : "border-ink/25 text-ink/70 hover:border-ink hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "block h-1 w-1 rounded-full",
                hasRecipient ? "bg-jade" : "bg-ink/30",
              )}
            />
            recipient · {hasRecipient ? "shown" : "hidden"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-ink px-3 py-1.5 font-mono-label text-[10px] hover:bg-ink hover:text-bone"
          >
            reopen modal
          </button>
        </div>
      </div>

      <p className="max-w-prose font-mono text-[11px] leading-relaxed text-ink/55">
        Renders <code>{`<WithdrawSuccess>`}</code> inside the real{" "}
        <code>{`<Modal>`}</code> with fixture data. Amount toggles preview the
        display number at a few scales. Fee toggles drive the receipt math —{" "}
        <code>loading</code> simulates the on-chain bps read in flight (fallback
        copy), the rest emit real fee + net rows. Suiscan link is live — clicking
        opens the (non-existent) tx on the current network's explorer.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Withdraw SUI"
      >
        <WithdrawSuccess
          amount={amount}
          digest={FIXTURE.digest}
          recipient={hasRecipient ? FIXTURE.recipient : undefined}
          capId={FIXTURE.capId}
          feeBps={feeBps}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </main>
  );
}

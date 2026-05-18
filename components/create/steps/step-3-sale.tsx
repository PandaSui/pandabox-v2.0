"use client";

import { useMemo } from "react";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import { StepSale, type SaleV } from "@/lib/store/wizard-schema";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import { Field, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";

const DAY = 86400_000;
const SALE_DURATIONS = [3, 7, 14, 30];

function toLocalInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(ts - tz).toISOString().slice(0, 16);
}
function fromLocalInput(s: string): number {
  return new Date(s).getTime();
}

export function StepSaleForm() {
  const sale = useWizard((s) => s.draft.sale);
  const ticker = useWizard((s) => s.draft.identity.ticker) ?? "TOK";
  const patch = useWizard((s) => s.patchSale);
  const errors = useMemo(() => parseErrors(sale), [sale]);

  const tokensPerSui = sale.tokensPerSui ?? "0";
  const allocation = sale.allocationTokens ?? "0";

  // Live derived figures.
  const baseRateScaled = useMemo(() => {
    const v = safeBN(tokensPerSui);
    return v.multipliedBy(new BigNumber(10).pow(PROJECT_COIN_DECIMALS));
  }, [tokensPerSui]);

  const allocationScaled = useMemo(() => {
    const v = safeBN(allocation);
    return v.multipliedBy(new BigNumber(10).pow(PROJECT_COIN_DECIMALS));
  }, [allocation]);

  const targetSuiRaise = useMemo(() => {
    const r = safeBN(tokensPerSui);
    const a = safeBN(allocation);
    if (r.isZero()) return null;
    return a.dividedBy(r);
  }, [tokensPerSui, allocation]);

  const now = Date.now();
  const endMs = sale.endTimeMs ?? null;
  const durationDays = endMs ? Math.max(0, Math.round((endMs - now) / DAY)) : null;

  return (
    <div className="space-y-8">
      <StepHeader
        n={3}
        accent="jade"
        title="Sale terms"
        body="Supporters contribute SUI in exchange for a Receipt. After the sale ends or sells out, they claim their token allocation. Anything unsold is burned or returned to you, per your choice."
        meta="immutable on deploy"
      />

      <StepCard
        title="Issuance"
        meta="tokens per 1 SUI"
      >
        <Field
          label="Tokens per SUI"
          hint={`How many ${ticker} a supporter receives for each 1 SUI contributed.`}
          error={errors.tokensPerSui}
        >
          {(id) => (
            <TextField
              id={id}
              value={tokensPerSui}
              onChange={(v) =>
                patch({ tokensPerSui: v.replace(/[^0-9.]/g, "") })
              }
              placeholder="100"
            />
          )}
        </Field>
        <DerivedRow
          label="base_rate (scaled, on-chain)"
          value={baseRateScaled.isFinite() ? baseRateScaled.toFixed(0) : "—"}
        />
      </StepCard>

      <StepCard title="Allocation" meta="total tokens for sale">
        <Field
          label="Tokens for sale"
          hint={`Total ${ticker} reserved for this sale. The TreasuryCap mints up to this amount.`}
          error={errors.allocationTokens}
        >
          {(id) => (
            <TextField
              id={id}
              value={allocation}
              onChange={(v) =>
                patch({ allocationTokens: v.replace(/[^0-9.]/g, "") })
              }
              placeholder="1000000"
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DerivedRow
            label="funding_allocation (raw u64)"
            value={
              allocationScaled.isFinite() ? allocationScaled.toFixed(0) : "—"
            }
          />
          <DerivedRow
            label="Target raise"
            value={
              targetSuiRaise && targetSuiRaise.isFinite()
                ? `${targetSuiRaise.toFormat(2, BigNumber.ROUND_DOWN)} SUI`
                : "—"
            }
          />
        </div>
      </StepCard>

      <StepCard title="Sale window" meta={durationDays != null ? `${durationDays}d` : "no time cap"}>
        <Field label="Ends">
          {() => (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {SALE_DURATIONS.map((d) => {
                  const target = now + d * DAY;
                  const active =
                    endMs != null && Math.abs((endMs - target) / DAY) < 0.5;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patch({ endTimeMs: target })}
                      aria-pressed={active}
                      className={cn(
                        "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                        active
                          ? "border-ink bg-ink text-bone shadow-offset-sm"
                          : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                      )}
                    >
                      in {d} days
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => patch({ endTimeMs: null })}
                  aria-pressed={endMs == null}
                  className={cn(
                    "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                    endMs == null
                      ? "border-ink bg-ink text-bone shadow-offset-sm"
                      : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                  )}
                >
                  no time cap
                </button>
              </div>
              <input
                type="datetime-local"
                value={toLocalInput(endMs)}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({ endTimeMs: v ? fromLocalInput(v) : null });
                }}
                disabled={endMs == null}
                className="h-12 w-full max-w-md border border-ink/25 bg-bone px-3 font-mono text-sm focus:border-ink focus:outline-none focus:shadow-offset-sm disabled:opacity-40"
              />
            </div>
          )}
        </Field>
      </StepCard>

      <StepCard title="Unsold supply" meta="after sale closes">
        <Field label="Action">
          {() => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    key: "burn",
                    title: "Burn",
                    body: "Unsold tokens are permanently destroyed, reducing total supply.",
                  },
                  {
                    key: "transfer_to_creator",
                    title: "Return to creator",
                    body: "Unsold tokens are minted to your address. Use for vesting or DEX seeding.",
                  },
                ] as const
              ).map((opt) => {
                const active = sale.unsoldAction === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => patch({ unsoldAction: opt.key })}
                    aria-pressed={active}
                    className={cn(
                      "text-left border bg-bone px-4 py-3 transition-all duration-200 ease-atelier",
                      active
                        ? "border-ink shadow-offset-sm"
                        : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                    )}
                  >
                    <div className="font-mono-label text-[10px] text-ink/55">
                      unsold_action · {opt.key === "burn" ? "0" : "1"}
                    </div>
                    <div className="mt-1 text-sm font-medium">{opt.title}</div>
                    <p className="mt-1 text-[12.5px] text-ink/60">{opt.body}</p>
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </StepCard>
    </div>
  );
}

function DerivedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-t border-ink/10 pt-2 first:border-t-0 first:pt-0">
      <span className="font-mono-label text-[10px] text-ink/55">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-ink/75">
        {value}
      </span>
    </div>
  );
}

function safeBN(s: string): BigNumber {
  if (!s) return new BigNumber(0);
  const n = new BigNumber(s);
  return n.isFinite() ? n : new BigNumber(0);
}

function parseErrors(sale: Partial<SaleV>) {
  const out: Record<string, string | undefined> = {};
  if (sale.tokensPerSui && sale.tokensPerSui.length > 0) {
    const r = StepSale.shape.tokensPerSui.safeParse(sale.tokensPerSui);
    if (!r.success) out.tokensPerSui = r.error.issues[0]?.message;
  }
  if (sale.allocationTokens && sale.allocationTokens.length > 0) {
    const r = StepSale.shape.allocationTokens.safeParse(sale.allocationTokens);
    if (!r.success) out.allocationTokens = r.error.issues[0]?.message;
  }
  return out;
}


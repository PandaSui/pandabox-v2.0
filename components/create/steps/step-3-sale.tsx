"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("create.step3");
  const sale = useWizard((s) => s.draft.sale);
  const ticker = useWizard((s) => s.draft.identity.ticker) ?? "TOK";
  const patch = useWizard((s) => s.patchSale);
  const errors = useMemo(() => parseErrors(sale), [sale]);

  const tokensPerSui = sale.tokensPerSui ?? "";
  const allocation = sale.allocationTokens ?? "";

  // Bidirectional editing for `tokens per SUI` ↔ `target raise`.
  // Tracking which side the user touched last lets us decide which value
  // is authoritative when the other (or `allocation`) changes.
  const [lastEdited, setLastEdited] = useState<"rate" | "raise">("rate");
  const [raiseInput, setRaiseInput] = useState<string>(() => {
    const r = safeBN(tokensPerSui);
    const a = safeBN(allocation);
    if (r.isZero() || a.isZero()) return "";
    return a.dividedBy(r).toFixed(4, BigNumber.ROUND_DOWN);
  });
  // Guard the effect against syncing back the value we just wrote.
  const skipNextSync = useRef(false);

  // When the rate side is authoritative, mirror raise from rate × allocation.
  useEffect(() => {
    if (lastEdited !== "rate") return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const r = safeBN(tokensPerSui);
    const a = safeBN(allocation);
    if (r.isZero() || a.isZero()) {
      setRaiseInput("");
      return;
    }
    setRaiseInput(a.dividedBy(r).toFixed(4, BigNumber.ROUND_DOWN));
  }, [tokensPerSui, allocation, lastEdited]);

  // When the raise side is authoritative and allocation changes, recompute
  // rate so the raise input the user typed stays put.
  useEffect(() => {
    if (lastEdited !== "raise") return;
    const raise = safeBN(raiseInput);
    const a = safeBN(allocation);
    if (raise.isZero() || a.isZero()) return;
    const newRate = a.dividedBy(raise).toFixed(6, BigNumber.ROUND_DOWN);
    if (newRate !== tokensPerSui) {
      skipNextSync.current = true;
      patch({ tokensPerSui: newRate });
    }
    // We deliberately omit `tokensPerSui` and `patch` from deps — we only
    // want to react to allocation changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocation, lastEdited, raiseInput]);

  // Live derived figures.
  const baseRateScaled = useMemo(() => {
    const v = safeBN(tokensPerSui);
    return v.multipliedBy(new BigNumber(10).pow(PROJECT_COIN_DECIMALS));
  }, [tokensPerSui]);

  const allocationScaled = useMemo(() => {
    const v = safeBN(allocation);
    return v.multipliedBy(new BigNumber(10).pow(PROJECT_COIN_DECIMALS));
  }, [allocation]);

  const now = Date.now();
  const endMs = sale.endTimeMs ?? null;
  const durationDays = endMs ? Math.max(0, Math.round((endMs - now) / DAY)) : null;

  const unsoldOptions = [
    {
      key: "burn" as const,
      title: t("unsoldBurnTitle"),
      body: t("unsoldBurnBody"),
    },
    {
      key: "transfer_to_creator" as const,
      title: t("unsoldReturnTitle"),
      body: t("unsoldReturnBody"),
    },
  ];

  return (
    <div className="space-y-8">
      <StepHeader
        n={3}
        accent="jade"
        title={t("title")}
        body={t("body")}
        meta={t("meta")}
      />

      <StepCard title={t("pricingTitle")} meta={t("pricingMeta")}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label={t("tokensPerSui")}
            hint={t("tokensPerSuiHint", { ticker })}
            error={errors.tokensPerSui}
          >
            {(id) => (
              <TextField
                id={id}
                value={tokensPerSui}
                onChange={(v) => {
                  setLastEdited("rate");
                  patch({ tokensPerSui: v.replace(/[^0-9.]/g, "") });
                }}
                placeholder="100"
              />
            )}
          </Field>
          <Field
            label={t("targetRaise")}
            hint={t("targetRaiseHint")}
          >
            {(id) => (
              <TextField
                id={id}
                value={raiseInput}
                onChange={(v) => {
                  const clean = v.replace(/[^0-9.]/g, "");
                  setLastEdited("raise");
                  setRaiseInput(clean);
                  const raise = safeBN(clean);
                  const a = safeBN(allocation);
                  if (raise.isZero() || a.isZero()) return;
                  skipNextSync.current = true;
                  patch({
                    tokensPerSui: a.dividedBy(raise).toFixed(6, BigNumber.ROUND_DOWN),
                  });
                }}
                placeholder="10000"
              />
            )}
          </Field>
        </div>
        <DerivedRow
          label={t("baseRateLabel")}
          value={baseRateScaled.isFinite() ? baseRateScaled.toFixed(0) : "—"}
        />
      </StepCard>

      <StepCard title={t("allocationTitle")} meta={t("allocationMeta")}>
        <Field
          label={t("tokensForSale")}
          hint={t("tokensForSaleHint", { ticker })}
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
            label={t("fundingAllocationLabel")}
            value={
              allocationScaled.isFinite() ? allocationScaled.toFixed(0) : "—"
            }
          />
          <DerivedRow
            label={t("maxSupplyLabel", { ticker })}
            value={
              allocation
                ? `${new BigNumber(allocation).toFormat(0)} ${ticker}`
                : "—"
            }
          />
          <DerivedRow
            label={t("mintedAtLaunch")}
            value={t("mintedAtLaunchValue")}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink/55">
          {t.rich("supplyNote", {
            zeroSupply: (chunks) => <span className="text-ink/75">{chunks}</span>,
            code: (chunks) => <code className="font-mono">{chunks}</code>,
            claimed: (chunks) => <span className="text-ink/75">{chunks}</span>,
          })}
          {sale.unsoldAction === "transfer_to_creator"
            ? t("supplyNoteReturn")
            : t("supplyNoteBurn")}
          .
        </p>
      </StepCard>

      <StepCard
        title={t("saleWindowTitle")}
        meta={
          durationDays != null
            ? t("durationDays", { days: durationDays })
            : t("noTimeCap")
        }
      >
        <Field label={t("ends")}>
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
                      {t("inDays", { days: d })}
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
                  {t("noTimeCap")}
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

      <StepCard title={t("unsoldTitle")} meta={t("unsoldMeta")}>
        <Field label={t("actionLabel")}>
          {() => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {unsoldOptions.map((opt) => {
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

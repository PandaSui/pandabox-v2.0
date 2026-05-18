"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import { StepCoin } from "@/lib/store/wizard-schema";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import { Field, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { Frame } from "@/components/primitives/frame";

type CoinMetaState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ok";
      name: string;
      symbol: string;
      decimals: number;
      coinType: string;
    }
  | { kind: "error"; message: string };

/**
 * Step 2 — Coin.
 *
 * `project::create_project<T>` consumes the caller's `TreasuryCap<T>` and
 * `CoinMetadata<T>` for the project token. The creator must have published
 * their own Coin module first (a separate flow / `sui client publish`).
 *
 * On this step we accept the two object IDs, then look up the
 * `CoinMetadata<T>` from chain to:
 *
 *   1. Derive the coin's fully-qualified type from `MetadataData.type`.
 *   2. Display name / symbol / decimals so the creator can verify.
 *   3. Validate that decimals == 9 (protocol requirement).
 */
export function StepCoinForm() {
  const coin = useWizard((s) => s.draft.coin);
  const patch = useWizard((s) => s.patchCoin);
  const client = useSuiClient();
  const [state, setState] = useState<CoinMetaState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const metadataId = coin.coinMetadataId ?? "";
  const treasuryCapId = coin.treasuryCapId ?? "";

  const errors = useMemo(() => parseErrors(coin), [coin]);

  // Look up the CoinMetadata object from chain whenever its ID changes.
  useEffect(() => {
    if (!metadataId || !StepCoin.shape.coinMetadataId.safeParse(metadataId).success) {
      setState({ kind: "idle" });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ kind: "loading" });

    (async () => {
      try {
        const obj = await client.getObject({
          id: metadataId,
          options: { showContent: true, showType: true },
        });
        if (ac.signal.aborted) return;
        if (obj.error || !obj.data) {
          setState({
            kind: "error",
            message:
              obj.error?.code === "notExists"
                ? "Object not found on this network."
                : "Could not read the metadata object.",
          });
          return;
        }
        // Type looks like "0x2::coin::CoinMetadata<0xabc::mycoin::MYCOIN>"
        const fullType = obj.data.type ?? "";
        const m = fullType.match(/CoinMetadata<(.+)>$/);
        if (!m) {
          setState({
            kind: "error",
            message: "Object is not a CoinMetadata<T>.",
          });
          return;
        }
        const coinType = m[1];
        const content = obj.data.content;
        if (!content || content.dataType !== "moveObject") {
          setState({ kind: "error", message: "Unexpected object content." });
          return;
        }
        const fields = (content as unknown as {
          fields: { name?: string; symbol?: string; decimals?: number };
        }).fields;
        setState({
          kind: "ok",
          name: fields.name ?? "",
          symbol: fields.symbol ?? "",
          decimals: Number(fields.decimals ?? 0),
          coinType,
        });
        // Patch into the wizard so the deploy step can submit without re-reading.
        patch({
          coinType,
          coinName: fields.name ?? "",
          coinSymbol: fields.symbol ?? "",
          coinDecimals: Number(fields.decimals ?? 0),
          verified: Number(fields.decimals ?? 0) === PROJECT_COIN_DECIMALS,
        });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Lookup failed.",
        });
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataId, client]);

  return (
    <div className="space-y-8">
      <StepHeader
        n={2}
        accent="poppy"
        title="Coin"
        body="Pandabox doesn't mint a coin for you. Publish your own Sui coin module first, then paste the TreasuryCap and CoinMetadata object IDs below. Both are consumed by the deploy transaction."
        meta="9 decimals required"
      />

      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex flex-col gap-2 text-sm text-ink/80">
          <span className="font-mono-label text-poppy">Need to publish a coin?</span>
          <p>
            Use <code className="font-mono text-[12px]">sui move new</code> with
            a minimal Coin template, publish it from your wallet, then look up
            the two created objects in your transaction's effects: the{" "}
            <code className="font-mono">TreasuryCap&lt;T&gt;</code> and{" "}
            <code className="font-mono">CoinMetadata&lt;T&gt;</code>. The
            protocol requires <strong>9 decimals</strong>.
          </p>
        </div>
      </Frame>

      <StepCard title="Object IDs" meta="must be owned by you">
        <Field
          label="TreasuryCap<T> object ID"
          hint="Found in the publish transaction's createdObjects."
          error={errors.treasuryCapId}
        >
          {(id) => (
            <TextField
              id={id}
              value={treasuryCapId}
              onChange={(v) => patch({ treasuryCapId: v.trim() })}
              placeholder="0x…"
              className="font-mono text-[12px]"
            />
          )}
        </Field>
        <Field
          label="CoinMetadata<T> object ID"
          hint="Pasted CoinMetadata is read from chain to detect the coin type and decimals."
          error={errors.coinMetadataId}
        >
          {(id) => (
            <TextField
              id={id}
              value={metadataId}
              onChange={(v) => patch({ coinMetadataId: v.trim() })}
              placeholder="0x…"
              className="font-mono text-[12px]"
            />
          )}
        </Field>
      </StepCard>

      <StepCard
        title="Coin info"
        meta={
          state.kind === "loading"
            ? "reading…"
            : state.kind === "ok"
              ? "detected"
              : state.kind === "error"
                ? "not found"
                : "—"
        }
      >
        {state.kind === "ok" ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Stat label="Name" value={state.name || "—"} />
              <Stat label="Symbol" value={state.symbol || "—"} mono />
              <Stat
                label="Decimals"
                value={String(state.decimals)}
                mono
                bad={state.decimals !== PROJECT_COIN_DECIMALS}
              />
            </div>
            <div className="border-t border-ink/10 pt-3">
              <span className="font-mono-label text-[10px] text-ink/55">
                Resolved coin type
              </span>
              <p className="mt-1 break-all font-mono text-[11px] text-ink/80">
                {state.coinType}
              </p>
            </div>
            {state.decimals !== PROJECT_COIN_DECIMALS && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
              >
                This coin is {state.decimals}-decimal. Pandabox requires{" "}
                {PROJECT_COIN_DECIMALS} decimals — redeploy your coin module
                with the correct value.
              </p>
            )}
          </>
        ) : state.kind === "error" ? (
          <p
            role="alert"
            className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
          >
            {state.message}
          </p>
        ) : state.kind === "loading" ? (
          <p className="font-mono text-[11px] text-ink/50">
            Reading from chain…
          </p>
        ) : (
          <p className="font-mono text-[11px] text-ink/45">
            Paste a CoinMetadata ID above to detect the coin.
          </p>
        )}
      </StepCard>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  bad,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bad?: boolean;
}) {
  return (
    <div>
      <span className="font-mono-label text-[10px] text-ink/55">{label}</span>
      <div
        className={cn(
          "mt-1 text-base",
          mono && "font-mono tabular-nums",
          bad && "text-poppy",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function parseErrors(coin: Partial<{ treasuryCapId?: string; coinMetadataId?: string }>) {
  const out: Record<string, string | undefined> = {};
  if (coin.treasuryCapId && coin.treasuryCapId.length > 0) {
    const r = StepCoin.shape.treasuryCapId.safeParse(coin.treasuryCapId);
    if (!r.success) out.treasuryCapId = r.error.issues[0]?.message;
  }
  if (coin.coinMetadataId && coin.coinMetadataId.length > 0) {
    const r = StepCoin.shape.coinMetadataId.safeParse(coin.coinMetadataId);
    if (!r.success) out.coinMetadataId = r.error.issues[0]?.message;
  }
  return out;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import { StepCoin } from "@/lib/store/wizard-schema";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import {
  buildPublishCoinTx,
  fetchPublishResult,
  parsePublishedCoin,
  rewriteCoinBytecode,
} from "@/lib/coin/publish";
import { renderCoinSource } from "@/lib/coin/source-template";
import { uploadBlob } from "@/lib/ipfs";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Frame } from "@/components/primitives/frame";
import { Field, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";

type Mode = "publish" | "paste";

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

export function StepCoinForm() {
  const coin = useWizard((s) => s.draft.coin);
  const identity = useWizard((s) => s.draft.identity);
  const patch = useWizard((s) => s.patchCoin);
  const patchDeploy = useWizard((s) => s.patchDeploy);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Default to "publish" the first time the user lands on this step; once
  // they've put in real IDs we honour what's there.
  const [mode, setMode] = useState<Mode>(() =>
    coin.coinType || coin.treasuryCapId || coin.coinMetadataId
      ? "paste"
      : "publish",
  );

  return (
    <div className="space-y-8">
      <StepHeader
        n={2}
        accent="poppy"
        title="Coin"
        body="Pandabox needs a Sui coin you own. You can publish one now in the browser using our audited template, or paste an existing TreasuryCap + CoinMetadata if you already have one."
        meta="9 decimals · created with sui::coin::create_currency"
      />

      <div className="flex flex-wrap items-center gap-2 border border-ink/15 bg-bone px-4 py-3">
        <span className="font-mono-label text-[10px] text-ink/55">Mode</span>
        {(
          [
            { key: "publish", label: "Publish a new coin" },
            { key: "paste", label: "I already have a coin" },
          ] as const
        ).map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              aria-pressed={active}
              className={cn(
                "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                active
                  ? "border-ink bg-ink text-bone shadow-offset-sm"
                  : "border-ink/25 hover:border-ink",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {mode === "publish" ? (
        <PublishCoinPanel
          identity={identity}
          coin={coin}
          patch={patch}
          patchDeploy={patchDeploy}
          account={account}
          client={client}
          signAndExecute={signAndExecute}
        />
      ) : (
        <PasteCoinPanel coin={coin} patch={patch} client={client} />
      )}
    </div>
  );
}

/* ─────────────────────────── Publish mode ─────────────────────────── */

type PublishState =
  | { kind: "idle" }
  | { kind: "rewriting" }
  | { kind: "signing" }
  | { kind: "fetching"; digest: string }
  | { kind: "pinning" }
  | { kind: "ok"; digest: string; packageId: string }
  | { kind: "error"; message: string };

function PublishCoinPanel({
  identity,
  coin,
  patch,
  patchDeploy,
  account,
  client,
  signAndExecute,
}: {
  identity: ReturnType<typeof useWizard.getState>["draft"]["identity"];
  coin: ReturnType<typeof useWizard.getState>["draft"]["coin"];
  patch: ReturnType<typeof useWizard.getState>["patchCoin"];
  patchDeploy: ReturnType<typeof useWizard.getState>["patchDeploy"];
  account: ReturnType<typeof useCurrentAccount>;
  client: ReturnType<typeof useSuiClient>;
  signAndExecute: ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];
}) {
  // Derive sensible defaults from the identity step.
  const defaultTicker = (identity.ticker ?? "").trim();
  const initialSymbol = defaultTicker || "TOK";
  const initialName = (identity.name ?? "").trim() || "Untitled coin";
  const initialDesc = (identity.tagline ?? "").trim().slice(0, 240);
  const initialIcon = (identity.coverImage ?? "").trim();

  const [symbol, setSymbol] = useState(initialSymbol);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [iconUrl, setIconUrl] = useState(initialIcon);
  const [state, setState] = useState<PublishState>({ kind: "idle" });

  // Re-derive identifiers from the symbol so the user never has to think
  // about Move conventions directly. moduleName must match the snake_case
  // identifier rules; witnessName the UPPER_SNAKE_CASE.
  const moduleName = useMemo(() => normalizeModuleName(symbol), [symbol]);
  const witnessName = useMemo(
    () => normalizeWitnessName(symbol),
    [symbol],
  );

  const errors = validatePublish({
    symbol,
    name,
    description,
    iconUrl,
    moduleName,
    witnessName,
  });
  const ready = Object.keys(errors).length === 0 && !!account;
  const busy =
    state.kind === "rewriting" ||
    state.kind === "signing" ||
    state.kind === "fetching" ||
    state.kind === "pinning";

  const onPublish = async () => {
    if (!ready || !account) return;
    try {
      setState({ kind: "rewriting" });
      const bytecode = await rewriteCoinBytecode({
        moduleName,
        witnessName,
        symbol,
        name,
        description,
        iconUrl,
      });

      setState({ kind: "signing" });
      const tx = buildPublishCoinTx({ bytecode, sender: account.address });
      const result = await signAndExecute({ transaction: tx });
      const digest =
        "digest" in result && typeof result.digest === "string"
          ? result.digest
          : undefined;
      if (!digest) {
        throw new Error("Wallet returned no digest for the publish tx.");
      }

      setState({ kind: "fetching", digest });
      const full = await fetchPublishResult(client, digest);
      const parsed = parsePublishedCoin(full.objectChanges);

      // Pin a rendered source.move blob for the audit trail (best effort —
      // a failed pin shouldn't block the user from moving on).
      try {
        setState({ kind: "pinning" });
        const src = renderCoinSource({
          moduleName,
          witnessName,
          symbol,
          name,
          description,
          iconUrl,
        });
        const upload = await uploadBlob(src, {
          filename: `${moduleName}.move`,
        });
        patchDeploy({ sourceCodeBlobId: upload.blobId });
      } catch {
        // ignore — source pin is optional
      }

      patch({
        coinType: parsed.coinType,
        treasuryCapId: parsed.treasuryCapId,
        coinMetadataId: parsed.coinMetadataId,
        coinName: name,
        coinSymbol: symbol,
        coinDecimals: PROJECT_COIN_DECIMALS,
        verified: true,
      });

      setState({ kind: "ok", digest, packageId: parsed.packageId });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Publish failed.",
      });
    }
  };

  return (
    <>
      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex flex-col gap-2 text-sm text-ink/80">
          <span className="font-mono-label text-poppy">How this works</span>
          <p>
            We start from a pre-compiled <code className="font-mono">coin_template.move</code> with{" "}
            <strong>9 decimals</strong>, rewrite its identifiers + metadata
            constants in your browser via{" "}
            <code className="font-mono">@mysten/move-bytecode-template</code>,
            then publish it from your wallet. The rendered Move source is pinned
            to IPFS so anyone can audit exactly what was deployed.
          </p>
        </div>
      </Frame>

      <StepCard title="Coin metadata" meta="goes into CoinMetadata<T>">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Symbol" hint="2–10 chars · uppercase letters / digits" error={errors.symbol}>
            {(id) => (
              <TextField
                id={id}
                value={symbol}
                onChange={(v) =>
                  setSymbol(v.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                }
                placeholder="PANDA"
                maxLength={10}
                className="font-mono"
              />
            )}
          </Field>
          <Field label="Name" error={errors.name}>
            {(id) => (
              <TextField
                id={id}
                value={name}
                onChange={setName}
                placeholder="Panda Token"
                maxLength={32}
              />
            )}
          </Field>
        </div>
        <Field label="Description" hint="≤240 chars · ASCII" error={errors.description}>
          {(id) => (
            <TextField
              id={id}
              value={description}
              onChange={setDescription}
              placeholder="What this coin represents."
              maxLength={240}
            />
          )}
        </Field>
        <Field label="Icon URL" hint="Reuse your project cover or paste a hosted URL" error={errors.iconUrl}>
          {(id) => (
            <TextField
              id={id}
              value={iconUrl}
              onChange={setIconUrl}
              placeholder="https://gateway.pinata.cloud/ipfs/…"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3 border-t border-ink/10 pt-3 font-mono text-[11px] text-ink/55">
          <div>
            <div className="font-mono-label text-[10px] text-ink/45">
              module
            </div>
            <div className="mt-1 break-all text-ink/80">
              {moduleName || "—"}
            </div>
          </div>
          <div>
            <div className="font-mono-label text-[10px] text-ink/45">
              witness
            </div>
            <div className="mt-1 break-all text-ink/80">
              {witnessName || "—"}
            </div>
          </div>
        </div>
      </StepCard>

      <StepCard title="Publish" meta={state.kind === "ok" ? "complete" : "step 1 of 2 deploys"}>
        {state.kind === "ok" ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-jade">
              <span className="inline-flex h-5 w-5 items-center justify-center border border-jade/40 bg-jade/10 font-mono text-[10px]">
                ✓
              </span>
              Coin published. TreasuryCap + CoinMetadata captured to draft.
            </div>
            <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:grid-cols-2">
              <SmallRow k="package" v={state.packageId} />
              <SmallRow
                k="coin type"
                v={`${state.packageId}::${moduleName}::${witnessName}`}
              />
              <SmallRow k="treasury cap" v={coin.treasuryCapId ?? ""} />
              <SmallRow k="metadata" v={coin.coinMetadataId ?? ""} />
              <SmallRow k="digest" v={state.digest} />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {account ? (
              <button
                type="button"
                onClick={onPublish}
                disabled={!ready || busy}
                className={cn(CTA_BASE, "bg-saffron text-ink")}
              >
                <span>
                  {state.kind === "rewriting"
                    ? "Rewriting bytecode…"
                    : state.kind === "signing"
                      ? "Signing…"
                      : state.kind === "fetching"
                        ? "Waiting for chain…"
                        : state.kind === "pinning"
                          ? "Pinning source…"
                          : "Publish coin"}
                </span>
                <ArrowDiag size={14} />
              </button>
            ) : (
              <ConnectWallet />
            )}
            <span className="font-mono-label text-[10px] text-ink/45">
              one transaction · transferable upgrade cap returned to you
            </span>
          </div>
        )}
        {state.kind === "error" && (
          <p
            role="alert"
            className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
          >
            {state.message}
          </p>
        )}
      </StepCard>
    </>
  );
}

function SmallRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="break-all border-t border-ink/10 pt-1.5">
      <span className="font-mono-label text-[10px] text-ink/45">{k}</span>
      <div className="mt-0.5">{shortMid(v)}</div>
    </div>
  );
}
function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function normalizeModuleName(symbol: string): string {
  const s = symbol.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!s) return "";
  if (/^[0-9]/.test(s)) return `c_${s}`;
  return s;
}
function normalizeWitnessName(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!s) return "";
  if (/^[0-9]/.test(s)) return `C_${s}`;
  return s;
}

function validatePublish(p: {
  symbol: string;
  name: string;
  description: string;
  iconUrl: string;
  moduleName: string;
  witnessName: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9_]{1,9}$/.test(p.symbol)) {
    out.symbol = "2–10 chars · A-Z, 0-9, _ · must start with a letter";
  }
  if (!p.name || p.name.length < 2 || p.name.length > 32) {
    out.name = "Add a name (2–32 chars)";
  }
  if (p.description.length > 240) {
    out.description = "Max 240 characters";
  }
  // eslint-disable-next-line no-control-regex
  if (!/^[\x20-\x7e]*$/.test(p.description)) {
    out.description = "ASCII only (no emoji / smart quotes)";
  }
  if (!/^https?:\/\/\S+$/.test(p.iconUrl)) {
    out.iconUrl = "Use a full https:// URL";
  }
  if (!p.moduleName) out.symbol = out.symbol ?? "Invalid identifier";
  if (!p.witnessName) out.symbol = out.symbol ?? "Invalid identifier";
  return out;
}

/* ─────────────────────────── Paste mode ─────────────────────────── */

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

function PasteCoinPanel({
  coin,
  patch,
  client,
}: {
  coin: ReturnType<typeof useWizard.getState>["draft"]["coin"];
  patch: ReturnType<typeof useWizard.getState>["patchCoin"];
  client: ReturnType<typeof useSuiClient>;
}) {
  const [state, setState] = useState<CoinMetaState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const metadataId = coin.coinMetadataId ?? "";
  const treasuryCapId = coin.treasuryCapId ?? "";
  const errors = useMemo(() => parsePasteErrors(coin), [coin]);

  useEffect(() => {
    if (
      !metadataId ||
      !StepCoin.shape.coinMetadataId.safeParse(metadataId).success
    ) {
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
          setState({ kind: "error", message: "Object not found." });
          return;
        }
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
        const fields = (
          content as unknown as {
            fields: { name?: string; symbol?: string; decimals?: number };
          }
        ).fields;
        setState({
          kind: "ok",
          name: fields.name ?? "",
          symbol: fields.symbol ?? "",
          decimals: Number(fields.decimals ?? 0),
          coinType,
        });
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
    <>
      <StepCard title="Object IDs" meta="must be owned by you">
        <Field
          label="TreasuryCap<T> object ID"
          hint="From your publish transaction's createdObjects."
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
          hint="We read this from chain to detect the coin type + decimals."
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
                {PROJECT_COIN_DECIMALS} decimals — redeploy your coin with the
                correct value.
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
    </>
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

function parsePasteErrors(coin: {
  treasuryCapId?: string;
  coinMetadataId?: string;
}) {
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

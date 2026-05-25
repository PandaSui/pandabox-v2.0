"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  MissingObjectChangesError,
  parsePublishedCoin,
  rewriteCoinBytecode,
} from "@/lib/coin/publish";
import { explorerUrl } from "@/lib/sui";
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
  const t = useTranslations("create.step2");
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

  const modeOptions = [
    { key: "publish" as const, label: t("modePublish") },
    { key: "paste" as const, label: t("modePaste") },
  ];

  return (
    <div className="space-y-8">
      <StepHeader
        n={2}
        accent="poppy"
        title={t("title")}
        body={t("body")}
        meta={t("meta")}
      />

      <div className="flex flex-wrap items-center gap-2 border border-ink/15 bg-bone px-4 py-3">
        <span className="font-mono-label text-[10px] text-ink/55">{t("modeLabel")}</span>
        {modeOptions.map((opt) => {
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
          onSwitchToPaste={() => setMode("paste")}
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
  | { kind: "stranded"; digest: string; message: string }
  | { kind: "error"; message: string };

function PublishCoinPanel({
  identity,
  coin,
  patch,
  patchDeploy,
  account,
  client,
  signAndExecute,
  onSwitchToPaste,
}: {
  identity: ReturnType<typeof useWizard.getState>["draft"]["identity"];
  coin: ReturnType<typeof useWizard.getState>["draft"]["coin"];
  patch: ReturnType<typeof useWizard.getState>["patchCoin"];
  patchDeploy: ReturnType<typeof useWizard.getState>["patchDeploy"];
  account: ReturnType<typeof useCurrentAccount>;
  client: ReturnType<typeof useSuiClient>;
  signAndExecute: ReturnType<typeof useSignAndExecuteTransaction>["mutateAsync"];
  onSwitchToPaste: () => void;
}) {
  const t = useTranslations("create.step2");
  // Derive sensible defaults from the identity step.
  const defaultTicker = (identity.ticker ?? "").trim();
  const initialSymbol = defaultTicker || "TOK";
  const initialName = (identity.name ?? "").trim() || t("untitledCoin");
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

  const errors = validatePublish(
    {
      symbol,
      name,
      description,
      iconUrl,
      moduleName,
      witnessName,
    },
    t,
  );
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
        throw new Error(t("errorNoDigest"));
      }

      setState({ kind: "fetching", digest });
      const full = await fetchPublishResult(client, digest);
      const parsed = parsePublishedCoin(full.objectChanges, digest);

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
      if (err instanceof MissingObjectChangesError) {
        setState({
          kind: "stranded",
          digest: err.digest,
          message: err.message,
        });
        return;
      }
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : t("errorPublishFailed"),
      });
    }
  };

  return (
    <>
      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex flex-col gap-2 text-sm text-ink/80">
          <span className="font-mono-label text-poppy">{t("howThisWorks")}</span>
          <p>
            {t.rich("howThisWorksBody", {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </Frame>

      <StepCard title={t("coinMetadataTitle")} meta={t("coinMetadataMeta")}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t("symbol")} hint={t("symbolHint")} error={errors.symbol}>
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
          <Field label={t("name")} error={errors.name}>
            {(id) => (
              <TextField
                id={id}
                value={name}
                onChange={setName}
                placeholder={t("namePlaceholder")}
                maxLength={32}
              />
            )}
          </Field>
        </div>
        <Field label={t("description")} hint={t("descriptionHint")} error={errors.description}>
          {(id) => (
            <TextField
              id={id}
              value={description}
              onChange={setDescription}
              placeholder={t("descriptionPlaceholder")}
              maxLength={240}
            />
          )}
        </Field>
        <Field label={t("iconUrl")} hint={t("iconUrlHint")} error={errors.iconUrl}>
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
              {t("moduleLabel")}
            </div>
            <div className="mt-1 break-all text-ink/80">
              {moduleName || "—"}
            </div>
          </div>
          <div>
            <div className="font-mono-label text-[10px] text-ink/45">
              {t("witnessLabel")}
            </div>
            <div className="mt-1 break-all text-ink/80">
              {witnessName || "—"}
            </div>
          </div>
        </div>
      </StepCard>

      <StepCard title={t("publishTitle")} meta={state.kind === "ok" ? t("publishMetaComplete") : t("publishMetaStep")}>
        {state.kind === "ok" ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-jade">
              <span className="inline-flex h-5 w-5 items-center justify-center border border-jade/40 bg-jade/10 font-mono text-[10px]">
                ✓
              </span>
              {t("coinPublishedConfirm")}
            </div>
            <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:grid-cols-2">
              <SmallRow k={t("rowPackage")} v={state.packageId} />
              <SmallRow
                k={t("rowCoinType")}
                v={`${state.packageId}::${moduleName}::${witnessName}`}
              />
              <SmallRow k={t("rowTreasuryCap")} v={coin.treasuryCapId ?? ""} />
              <SmallRow k={t("rowMetadata")} v={coin.coinMetadataId ?? ""} />
              <SmallRow k={t("rowDigest")} v={state.digest} />
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
                    ? t("publishStateRewriting")
                    : state.kind === "signing"
                      ? t("publishStateSigning")
                      : state.kind === "fetching"
                        ? t("publishStateFetching")
                        : state.kind === "pinning"
                          ? t("publishStatePinning")
                          : t("publishCoin")}
                </span>
                <ArrowDiag size={14} />
              </button>
            ) : (
              <ConnectWallet />
            )}
            <span className="font-mono-label text-[10px] text-ink/45">
              {t("publishCaption")}
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
        {state.kind === "stranded" && (
          <Frame className="border-sun bg-sun/10 [&::after]:bg-sun/25 [&::before]:bg-sun/25">
            <div role="alert" className="space-y-3 text-sm text-ink/80">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="block h-1.5 w-1.5 rounded-full bg-sun"
                />
                <span className="font-mono-label text-ink">
                  {t("strandedTitle")}
                </span>
              </div>
              <p>{state.message}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={explorerUrl("tx", state.digest)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 border border-ink bg-bone px-4 shadow-offset-sm",
                    "font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem] text-ink",
                    "transition-all duration-200 ease-atelier",
                    "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  )}
                >
                  <span>{t("openOnSuiExplorer")}</span>
                  <ArrowDiag size={12} />
                </a>
                <button
                  type="button"
                  onClick={onSwitchToPaste}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 border border-ink bg-saffron px-4 text-ink shadow-offset-sm",
                    "font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem]",
                    "transition-all duration-200 ease-atelier",
                    "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  )}
                >
                  <span>{t("switchToPasteMode")}</span>
                  <ArrowDiag size={12} />
                </button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
                {t("digestLabel")} · {state.digest}
              </p>
            </div>
          </Frame>
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

function validatePublish(
  p: {
    symbol: string;
    name: string;
    description: string;
    iconUrl: string;
    moduleName: string;
    witnessName: string;
  },
  t: (key: string) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9_]{1,9}$/.test(p.symbol)) {
    out.symbol = t("validateSymbol");
  }
  if (!p.name || p.name.length < 2 || p.name.length > 32) {
    out.name = t("validateName");
  }
  if (p.description.length > 240) {
    out.description = t("validateDescriptionLength");
  }
  // eslint-disable-next-line no-control-regex
  if (!/^[\x20-\x7e]*$/.test(p.description)) {
    out.description = t("validateDescriptionAscii");
  }
  if (!/^https?:\/\/\S+$/.test(p.iconUrl)) {
    out.iconUrl = t("validateIconUrl");
  }
  if (!p.moduleName) out.symbol = out.symbol ?? t("validateInvalidIdentifier");
  if (!p.witnessName) out.symbol = out.symbol ?? t("validateInvalidIdentifier");
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
  const t = useTranslations("create.step2");
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
          setState({ kind: "error", message: t("errorObjectNotFound") });
          return;
        }
        const fullType = obj.data.type ?? "";
        const m = fullType.match(/CoinMetadata<(.+)>$/);
        if (!m) {
          setState({
            kind: "error",
            message: t("errorNotCoinMetadata"),
          });
          return;
        }
        const coinType = m[1];
        const content = obj.data.content;
        if (!content || content.dataType !== "moveObject") {
          setState({ kind: "error", message: t("errorUnexpectedContent") });
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
          message: err instanceof Error ? err.message : t("errorLookupFailed"),
        });
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataId, client]);

  return (
    <>
      <StepCard title={t("objectIdsTitle")} meta={t("objectIdsMeta")}>
        <Field
          label={t("treasuryCapLabel")}
          hint={t("treasuryCapHint")}
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
          label={t("metadataLabel")}
          hint={t("metadataHint")}
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
        title={t("coinInfoTitle")}
        meta={
          state.kind === "loading"
            ? t("coinInfoMetaReading")
            : state.kind === "ok"
              ? t("coinInfoMetaDetected")
              : state.kind === "error"
                ? t("coinInfoMetaNotFound")
                : "—"
        }
      >
        {state.kind === "ok" ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Stat label={t("statName")} value={state.name || "—"} />
              <Stat label={t("statSymbol")} value={state.symbol || "—"} mono />
              <Stat
                label={t("statDecimals")}
                value={String(state.decimals)}
                mono
                bad={state.decimals !== PROJECT_COIN_DECIMALS}
              />
            </div>
            <div className="border-t border-ink/10 pt-3">
              <span className="font-mono-label text-[10px] text-ink/55">
                {t("resolvedCoinType")}
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
                {t("wrongDecimals", {
                  decimals: state.decimals,
                  required: PROJECT_COIN_DECIMALS,
                })}
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
            {t("readingFromChain")}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-ink/45">
            {t("pasteMetadataHint")}
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

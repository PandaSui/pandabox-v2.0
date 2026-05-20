"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { gatewayUrl, isLikelyCid, resolveBlobRef, uploadBlob } from "@/lib/ipfs";
import { MonoLabel } from "@/components/primitives/mono-label";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const MAX_MB = 8;

export type ImageUploadValue = {
  /** CID once pinned, or the original string while user is still pasting. */
  cid: string;
  /** Resolved gateway URL for display. */
  url: string;
};

type UploadPhase = "transfer" | "pinning";
type UploadState =
  | { kind: "idle" }
  | {
      kind: "uploading";
      phase: UploadPhase;
      progress: number;
      name: string;
      sizeBytes: number;
    }
  | { kind: "error"; message: string };

/**
 * Drag/drop or click-to-upload, with paste-CID escape hatch. Pins to IPFS
 * via /api/upload and writes the CID + gateway URL back to the parent draft.
 *
 * Variants:
 *   - "cover" (default) — 16:10 cover-image surface for project hero
 *   - "tile"            — square, used inside tier editors
 */
export function ImageUpload({
  value,
  onChange,
  variant = "cover",
  label = "Cover image",
  hint,
}: {
  value?: string;
  onChange: (v: ImageUploadValue | null) => void;
  variant?: "cover" | "tile";
  label?: string;
  hint?: string;
}) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  // Gateway propagation can lag a few seconds after pin — bump this on
  // <img onError> with backoff so we re-request the same URL up to 4×.
  const [retryAttempt, setRetryAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resolved = resolveBlobRef(value);
  const isDraftPreview = !resolved && !!value && value.startsWith("/");
  const previewUrl = resolved?.url ?? (isDraftPreview ? value : null);

  // Reset load state whenever the preview URL changes so a new upload (or
  // pasted CID) starts the skeleton fresh and doesn't inherit the previous
  // image's loaded=true.
  useEffect(() => {
    setImgLoaded(false);
    setRetryAttempt(0);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [previewUrl]);

  const startUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setState({ kind: "error", message: "Only image files are allowed." });
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setState({
          kind: "error",
          message: `Image too large (${(file.size / 1024 / 1024).toFixed(2)} MiB). Max ${MAX_MB} MiB.`,
        });
        return;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setState({
        kind: "uploading",
        phase: "transfer",
        progress: 0,
        name: file.name,
        sizeBytes: file.size,
      });

      try {
        const result = await uploadBlob(file, {
          signal: ac.signal,
          onProgress: (loaded, total) => {
            const pct =
              total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
            setState({
              kind: "uploading",
              phase: "transfer",
              progress: pct,
              name: file.name,
              sizeBytes: file.size,
            });
          },
          onUploaded: () => {
            setState({
              kind: "uploading",
              phase: "pinning",
              progress: 100,
              name: file.name,
              sizeBytes: file.size,
            });
          },
        });
        onChange({ cid: result.blobId, url: result.gatewayUrl });
        setState({ kind: "idle" });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Upload failed unexpectedly.",
        });
      }
    },
    [onChange],
  );

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    setState({ kind: "idle" });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) startUpload(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    // reset so re-selecting same file works
    e.target.value = "";
  };

  const clear = () => {
    abortRef.current?.abort();
    onChange(null);
    setState({ kind: "idle" });
  };

  const onPasteCid = (raw: string) => {
    const v = raw.trim();
    if (!v) {
      onChange(null);
      return;
    }
    if (isLikelyCid(v)) {
      onChange({ cid: v, url: gatewayUrl(v) });
    } else {
      // Could be a full URL — let resolveBlobRef figure it out
      const r = resolveBlobRef(v);
      if (r) onChange({ cid: r.blobId, url: r.url });
      else onChange({ cid: v, url: v }); // fallback to raw value (legacy paths)
    }
  };

  const isCover = variant === "cover";
  const aspect = isCover ? "aspect-[16/10]" : "aspect-square";
  const uploading = state.kind === "uploading";
  // Skeleton sits between "pin succeeded" and "gateway returns bytes". When
  // an upload is still in flight, the upload card is already the source of
  // truth so we hide the skeleton to avoid double-status.
  const showSkeleton = !!previewUrl && !imgLoaded && !uploading;
  // Cache-bust on retry so the gateway can't return a stale 404 from its
  // edge cache while the pin finishes propagating.
  const imgSrc =
    previewUrl && retryAttempt > 0
      ? `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}r=${retryAttempt}`
      : previewUrl;
  const handleImgError = () => {
    if (retryAttempt >= 4) return;
    const delayMs = 800 * (retryAttempt + 1);
    retryTimerRef.current = setTimeout(() => {
      setRetryAttempt((n) => n + 1);
    }, delayMs);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <MonoLabel className="block">{label}</MonoLabel>
        {resolved && (
          <span className="font-mono text-[10px] text-ink/45">
            cid · {shortCid(resolved.blobId)}
          </span>
        )}
      </div>

      <div
        className={cn(
          "relative w-full overflow-hidden border bg-bone transition-colors",
          aspect,
          dragging
            ? "border-saffron"
            : previewUrl
              ? "border-ink/25"
              : "border-dashed border-ink/30 hover:border-ink",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
      >
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={`${previewUrl}-${retryAttempt}`}
            src={imgSrc ?? previewUrl}
            alt=""
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              uploading
                ? "opacity-60"
                : imgLoaded
                  ? "opacity-100"
                  : "opacity-0",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
          >
            <UploadGlyph />
            <span className="font-mono-label text-[11px] text-ink/70">
              {dragging ? "Drop to pin" : "Drag an image or click to upload"}
            </span>
            <span className="font-mono text-[10px] text-ink/45">
              {ACCEPT.replace(/image\//g, "").replace(/,/g, " · ")} · max {MAX_MB} MiB
            </span>
          </button>
        )}

        {/* IPFS gateway warm-up skeleton — pin succeeded but the gateway
            hasn't started serving the blob yet (typically a few seconds).
            We pulse a neutral surface and show a small status pill so the
            user knows the image is coming, not stuck. */}
        {showSkeleton && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink/[0.05] via-ink/[0.12] to-ink/[0.05]" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "repeating-linear-gradient(115deg, rgba(22,19,16,0.05) 0 8px, transparent 8px 22px)",
              }}
            />
            <div className="absolute inset-x-3 bottom-3 border border-ink bg-bone shadow-offset-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-saffron stat-live-dot" />
                  <span className="font-mono-label text-[10px] text-ink">
                    loading from ipfs
                  </span>
                </div>
                <span className="font-mono text-[10px] text-ink/45">
                  {retryAttempt > 0
                    ? `gateway retry ${retryAttempt}/4`
                    : "gateway warm-up"}
                </span>
              </div>
              <div className="relative h-[2px] w-full overflow-hidden bg-ink/10">
                <div className="ipfs-indeterminate-bar absolute inset-y-0 left-0 w-1/3 bg-saffron" />
              </div>
            </div>
          </div>
        )}

        {previewUrl && !uploading && imgLoaded && (
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="border border-ink bg-bone/95 px-2 py-1 font-mono-label text-[10px] hover:bg-ink hover:text-bone transition-colors"
            >
              replace
            </button>
            <button
              type="button"
              onClick={clear}
              className="border border-ink bg-bone/95 px-2 py-1 font-mono-label text-[10px] hover:bg-poppy hover:text-bone hover:border-poppy transition-colors"
            >
              remove
            </button>
          </div>
        )}

        {state.kind === "uploading" && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-bone/45" />
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="absolute inset-x-3 bottom-3 border border-ink bg-bone shadow-offset-sm"
            >
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-saffron stat-live-dot" />
                  <span className="font-mono-label text-[10px] text-ink">
                    {state.phase === "transfer"
                      ? "uploading"
                      : "pinning to ipfs"}
                  </span>
                  <span className="truncate font-mono text-[10px] text-ink/45">
                    · {state.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-ink">
                    {state.phase === "transfer"
                      ? `${state.progress}%`
                      : formatBytes(state.sizeBytes)}
                  </span>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="border border-ink/25 px-2 py-[2px] font-mono-label text-[9px] text-ink/70 transition-colors hover:border-ink hover:text-ink"
                    aria-label="Cancel upload"
                  >
                    cancel
                  </button>
                </div>
              </div>
              <div
                className="relative h-[2px] w-full overflow-hidden bg-ink/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  state.phase === "transfer" ? state.progress : undefined
                }
              >
                {state.phase === "transfer" ? (
                  <div
                    className="h-full bg-saffron transition-[width] duration-150 ease-out"
                    style={{ width: `${state.progress}%` }}
                  />
                ) : (
                  <div className="ipfs-indeterminate-bar absolute inset-y-0 left-0 w-1/3 bg-saffron" />
                )}
              </div>
              <p className="px-3 pb-2 pt-1 font-mono text-[9px] leading-snug text-ink/45">
                {state.phase === "transfer"
                  ? "sending bytes to the pinning service"
                  : "pinata is replicating across ipfs nodes — this can take a few seconds for large images"}
              </p>
            </div>
          </>
        )}
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
        >
          {state.message}
        </p>
      )}

      {hint && <p className="font-mono text-[10px] text-ink/45">{hint}</p>}

      {/* Paste-CID escape hatch — power-users with an existing pin */}
      <details className="group">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink">
          or paste an existing CID / URL
        </summary>
        <input
          type="text"
          defaultValue={resolved?.blobId ?? value ?? ""}
          onBlur={(e) => onPasteCid(e.target.value)}
          placeholder="Qm… / bafy… / ipfs://… / https://gateway/ipfs/…"
          className="mt-2 h-10 w-full border border-ink/25 bg-bone px-3 font-mono text-[11px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm"
        />
      </details>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onFileInput}
        className="hidden"
      />
    </div>
  );
}

function UploadGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink/55"
      aria-hidden
    >
      <path d="M12 4v12" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 18v2h16v-2" />
    </svg>
  );
}

function shortCid(cid: string): string {
  if (cid.length <= 14) return cid;
  return `${cid.slice(0, 8)}…${cid.slice(-4)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

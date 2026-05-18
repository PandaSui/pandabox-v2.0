"use client";

import { useCallback, useRef, useState } from "react";
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

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number; name: string }
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
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resolved = resolveBlobRef(value);
  const isDraftPreview = !resolved && !!value && value.startsWith("/");
  const previewUrl = resolved?.url ?? (isDraftPreview ? value : null);

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
      setState({ kind: "uploading", progress: 0, name: file.name });

      try {
        const result = await uploadBlob(file, { signal: ac.signal });
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
            src={previewUrl}
            alt=""
            className={cn(
              "h-full w-full object-cover",
              uploading && "opacity-60",
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

        {previewUrl && !uploading && (
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

        {uploading && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-0 bottom-0 border-t border-ink/15 bg-bone/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70"
          >
            <span className="inline-flex items-center gap-2">
              <span className="block h-1.5 w-1.5 rounded-full bg-saffron stat-live-dot" />
              pinning to ipfs · {state.name}
            </span>
          </div>
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

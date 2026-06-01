/**
 * Pinata-backed IPFS storage. Used to pin project description (Markdown) and
 * icon image, with the resulting CID stored in the on-chain Project record's
 * `description_blob_id` field and the gateway URL in `icon_url`.
 *
 * Two split surfaces:
 *
 *   - Client (anywhere): `IPFS_GATEWAY`, `gatewayUrl`, `resolveBlobRef`,
 *     `fetchBlobText`, and `uploadBlob`/`uploadJson` which POST to the
 *     Next.js `/api/upload` route handler (browser code never sees the JWT).
 *
 *   - Server (route handler only): `pinFileToPinata`, which actually talks
 *     to Pinata using `PINATA_JWT` (server-only env var, no NEXT_PUBLIC).
 *
 * Configure with:
 *   PINATA_JWT               Bearer token from Pinata. Server-side only — never NEXT_PUBLIC.
 *   NEXT_PUBLIC_IPFS_GATEWAY Base URL for reads, no trailing slash. Default = Pinata public.
 */

const FALLBACK_GATEWAY = "https://gateway.pinata.cloud";

const RAW_GATEWAY = (process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "").trim();
export const IPFS_GATEWAY = (
  RAW_GATEWAY.length > 0 ? RAW_GATEWAY : FALLBACK_GATEWAY
).replace(/\/+$/, "");

// When the configured gateway can't serve a CID — rate-limited (HTTP 429), a
// TLS hiccup, a timeout — reads transparently retry the SAME CID on these
// public gateways. IPFS is content-addressed, so every gateway returns
// byte-identical content. These hosts must also be allowlisted in
// next.config `images.remotePatterns` for the client `<Image>` fallback.
export const FALLBACK_READ_GATEWAYS = [
  "https://ipfs.io",
  "https://nftstorage.link",
  "https://dweb.link",
];

/**
 * Ordered, de-duplicated gateway bases to try for a read: the configured
 * gateway first, then the public fallbacks. The configured gateway may itself
 * be one of the fallbacks, hence the de-dupe.
 */
function readGatewayBases(): string[] {
  const bases = [IPFS_GATEWAY, ...FALLBACK_READ_GATEWAYS].map((b) =>
    b.replace(/\/+$/, ""),
  );
  return [...new Set(bases)];
}

// Kept for backwards compatibility with components written for the Walrus
// version of this module. Pinata pins don't have a per-upload epoch concept.
export const DEFAULT_EPOCHS = 0;

export type UploadResult = {
  /** Canonical IPFS CID (v0 `Qm…` or v1 `bafy…`) for the pinned content. */
  blobId: string;
  /** Gateway URL pointing at the pinned content. Ready to drop into `<img src>` etc. */
  gatewayUrl: string;
  /** Pinata reports a pin even on duplicate content — they de-dupe by CID. */
  alreadyCertified: boolean;
  /** Raw Pinata response, for debugging. */
  raw: unknown;
};

/**
 * Browser-side upload. POSTs the file to `/api/upload`, which forwards it to
 * Pinata with the server-side JWT. Same content uploaded twice gets the same CID.
 *
 * `onProgress` fires while bytes are still streaming from the browser; once it
 * resolves to 100% (or `onUploaded` fires) the bytes are in our route handler
 * and Pinata is pinning — that's the "pinning to ipfs" wait the UI surfaces.
 */
export async function uploadBlob(
  data: Blob | ArrayBuffer | Uint8Array | string | File,
  opts?: {
    signal?: AbortSignal;
    filename?: string;
    onProgress?: (loaded: number, total: number) => void;
    onUploaded?: () => void;
  },
): Promise<UploadResult> {
  const form = new FormData();
  if (data instanceof File) {
    form.append("file", data);
  } else if (data instanceof Blob) {
    form.append("file", data, opts?.filename ?? "blob.bin");
  } else if (data instanceof Uint8Array) {
    form.append(
      "file",
      new Blob([data as BlobPart]),
      opts?.filename ?? "blob.bin",
    );
  } else if (data instanceof ArrayBuffer) {
    form.append("file", new Blob([data]), opts?.filename ?? "blob.bin");
  } else {
    form.append(
      "file",
      new Blob([data], { type: "text/plain; charset=utf-8" }),
      opts?.filename ?? "description.md",
    );
  }

  return new Promise<UploadResult>((resolve, reject) => {
    if (opts?.signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    const onAbort = () => xhr.abort();
    opts?.signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts?.onProgress?.(e.loaded, e.total);
    };
    xhr.upload.onload = () => opts?.onUploaded?.();

    xhr.onload = () => {
      opts?.signal?.removeEventListener("abort", onAbort);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            `IPFS upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`,
          ),
        );
        return;
      }
      let json: Partial<UploadResult> & { error?: string };
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Unexpected upload response: not JSON"));
        return;
      }
      if (json.error || !json.blobId || !json.gatewayUrl) {
        reject(
          new Error(
            json.error ??
              "Unexpected upload response: " +
                JSON.stringify(json).slice(0, 200),
          ),
        );
        return;
      }
      resolve({
        blobId: json.blobId,
        gatewayUrl: json.gatewayUrl,
        alreadyCertified: !!json.alreadyCertified,
        raw: json.raw,
      });
    };
    xhr.onerror = () => {
      opts?.signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error during upload"));
    };
    xhr.onabort = () => {
      opts?.signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    xhr.send(form);
  });
}

/**
 * Pin a JSON value to IPFS. Serializes with 2-space indent so the pinned file
 * is human-readable in any IPFS gateway.
 */
export async function uploadJson(
  value: unknown,
  opts?: { signal?: AbortSignal; filename?: string },
): Promise<UploadResult> {
  const text = JSON.stringify(value, null, 2);
  return uploadBlob(text, {
    ...opts,
    filename: opts?.filename ?? "project_details.json",
  });
}

/** Public gateway URL serving the bytes for a CID. */
export function gatewayUrl(cid: string): string {
  return `${IPFS_GATEWAY}/ipfs/${encodeURIComponent(cid)}`;
}

// Backwards-compat alias for code that still calls aggregatorUrl().
export const aggregatorUrl = gatewayUrl;

/**
 * Ordered list of gateway URLs to try for an on-chain icon/blob reference.
 * Configured gateway first, then public fallbacks (same CID). Used by the
 * client `<Image>` fallback so a throttled primary gateway doesn't blank
 * covers. Returns `[]` for an empty/placeholder ref, or a single-element list
 * for a non-IPFS URL we can't decompose into a CID.
 */
export function ipfsGatewayCandidates(
  ref: string | null | undefined,
): string[] {
  const resolved = resolveBlobRef(ref);
  if (!resolved) {
    const trimmed = (ref ?? "").trim();
    return trimmed ? [trimmed] : [];
  }
  return readGatewayBases().map(
    (base) => `${base}/ipfs/${encodeURIComponent(resolved.blobId)}`,
  );
}

/**
 * GET the blob and return its body as text (UTF-8), retrying across gateways.
 * The configured gateway is tried first; on a non-OK response (e.g. a 429 from
 * a throttled public gateway) or a network/TLS error, the same CID is retried
 * on the next fallback gateway. A caller-driven abort stops the retries.
 */
export async function fetchBlobText(
  cid: string,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  const bases = readGatewayBases();
  let lastError: unknown;
  for (const base of bases) {
    if (opts?.signal?.aborted) break;
    try {
      const res = await fetch(`${base}/ipfs/${encodeURIComponent(cid)}`, {
        signal: opts?.signal,
      });
      if (!res.ok) {
        lastError = new Error(
          `IPFS gateway fetch failed (${res.status}): ${res.statusText}`,
        );
        continue;
      }
      return await res.text();
    } catch (err) {
      // A caller-driven abort is intentional — don't fall through to retries.
      if (opts?.signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw (
    lastError ?? new Error("IPFS gateway fetch failed: no gateways configured")
  );
}

/**
 * Normalize whatever the on-chain `description_blob_id` / `icon_url` field
 * happens to hold. Accepts:
 *
 *   - bare CID                    "Qm…" / "bafy…"
 *   - ipfs scheme                 "ipfs://Qm…"
 *   - any gateway URL             "https://…/ipfs/Qm…"
 *   - bare Walrus blob id         "Lbkdmn…" (testnet legacy)
 *   - walrus scheme               "walrus://Lbkdmn…"
 *   - Walrus aggregator URL       "https://aggregator…/v1/blobs/Lbkdmn…"
 *
 * Returns null when the field is empty or a known placeholder.
 */
export function resolveBlobRef(
  ref: string | null | undefined,
): { blobId: string; url: string } | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (/^walrus:\/\/placeholder$/i.test(trimmed)) return null;
  if (/^ipfs:\/\/placeholder$/i.test(trimmed)) return null;

  let id: string | null = null;
  if (trimmed.startsWith("ipfs://")) {
    id = trimmed.slice("ipfs://".length);
  } else if (trimmed.startsWith("walrus://")) {
    id = trimmed.slice("walrus://".length);
  } else if (/^https?:\/\//i.test(trimmed)) {
    let m = trimmed.match(/\/ipfs\/([^/?#]+)/);
    if (m) id = decodeURIComponent(m[1]);
    if (!id) {
      m = trimmed.match(/\/v1\/blobs\/([^/?#]+)/);
      if (m) id = decodeURIComponent(m[1]);
    }
  } else if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    id = trimmed;
  }
  if (!id) return null;
  return { blobId: id, url: gatewayUrl(id) };
}

/**
 * Quick check for whether a string looks like a CID we'd accept (used for
 * draft hydration / display). Doesn't validate the multihash — just the shape.
 */
export function isLikelyCid(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim();
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(v) || /^bafy[a-z2-7]{50,}$/i.test(v);
}

import { NextResponse } from "next/server";

// Pinata pinning endpoint. Server-only — the JWT must never reach the browser.
const PINATA_PIN_FILE = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const FALLBACK_GATEWAY = "https://gateway.pinata.cloud";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB — covers cover images + JSON

export const runtime = "nodejs";

function gatewayUrl(cid: string): string {
  const raw = (process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "").trim();
  const base = (raw.length > 0 ? raw : FALLBACK_GATEWAY).replace(/\/+$/, "");
  return `${base}/ipfs/${encodeURIComponent(cid)}`;
}

export async function POST(req: Request) {
  const jwt = (process.env.PINATA_JWT ?? "").trim();
  if (!jwt) {
    return NextResponse.json(
      {
        error:
          "Pinata not configured. Set PINATA_JWT in .env.local (Pinata dashboard → API Keys).",
      },
      { status: 500 },
    );
  }

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }

  const file = inForm.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing `file` field in upload." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MiB). Max ${MAX_BYTES / 1024 / 1024} MiB.`,
      },
      { status: 413 },
    );
  }

  // Pinata expects the field name "file". Forward the user's filename so the
  // pinned entry shows up with a recognisable name in their Pinata dashboard.
  const filename =
    (file as File).name && (file as File).name.length > 0
      ? (file as File).name
      : "upload.bin";
  const outForm = new FormData();
  outForm.append("file", file, filename);

  let res: Response;
  try {
    res = await fetch(PINATA_PIN_FILE, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: outForm,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Failed to reach Pinata: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Pinata upload failed (${res.status}): ${text || res.statusText}`,
      },
      { status: 502 },
    );
  }

  const json = (await res.json().catch(() => null)) as {
    IpfsHash?: string;
    isDuplicate?: boolean;
  } | null;
  if (!json || !json.IpfsHash) {
    return NextResponse.json(
      {
        error:
          "Unexpected Pinata response: " +
          JSON.stringify(json ?? {}).slice(0, 200),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    blobId: json.IpfsHash,
    gatewayUrl: gatewayUrl(json.IpfsHash),
    alreadyCertified: !!json.isDuplicate,
    raw: json,
  });
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getOnchainProject } from "@/lib/projects";
import { resolveBlobRef } from "@/lib/ipfs";

// Read the bundled panda logo once per worker. ImageResponse can't resolve
// relative public paths — it needs an absolute URL or an embedded data URL.
// The PNG is small (~280KB); reading it once and reusing across requests
// keeps OG generation cheap.
let logoDataUrlPromise: Promise<string> | null = null;
function getLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = readFile(
      path.join(process.cwd(), "public/panda-logo.png"),
    )
      .then((buf) => `data:image/png;base64,${buf.toString("base64")}`)
      .catch(() => "");
  }
  return logoDataUrlPromise;
}

export const alt = "Pandabox project — programmable funding on Sui.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Revalidate on the same cadence as the project page. Without this the OG
// route is cached as a static asset and freezes at first-render data — so the
// card keeps showing a stale raised amount / percentage long after the page
// itself has moved on (e.g. "20 SUI · 1%" while the project is really at
// "220 SUI · 11%"). 30s matches `page.tsx` and the `cachedHydrated` reader.
export const revalidate = 30;

// Public IPFS gateways tried, in order, when the configured gateway can't
// serve the cover. The default public Pinata gateway aggressively rate-limits
// server-side requests (returns HTTP 429 under OG-crawler load), which is the
// usual reason a cover box renders blank. Because IPFS is content-addressed,
// every gateway returns byte-identical content for a given CID, so retrying
// the same CID elsewhere is safe.
const FALLBACK_IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://nftstorage.link/ipfs",
];

/**
 * Fetch one URL and, if it's a Satori-decodable raster image, return it as a
 * base64 data URL. Returns null on any failure (non-OK, wrong format, timeout)
 * so the caller can try the next candidate.
 *
 * Satori (next/og) only decodes PNG/JPEG/GIF — SVG/WebP/AVIF render blank — so
 * we gate on content-type. We also pull the bytes ourselves (rather than let
 * Satori fetch the remote `<img src>`) to cap the wait and avoid its
 * silently-blank-on-failure behavior.
 */
async function fetchRasterDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "image/png,image/jpeg,image/gif,image/*" },
    });
    if (!res.ok) return null;

    const type = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/gif"].includes(type)) {
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    // Guard against an oversized payload bloating the OG response.
    if (buf.byteLength === 0 || buf.byteLength > 5_000_000) return null;

    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a project cover to an inline data URL, resilient to a throttled
 * primary gateway. Tries the configured gateway URL first, then — when we have
 * a CID — the same CID on public fallback gateways before giving up to the
 * "NO COVER" placeholder.
 */
async function loadCoverDataUrl(
  ref: { blobId: string; url: string } | null,
  rawUrl: string,
): Promise<string | null> {
  const candidates: string[] = [];
  if (ref?.url) candidates.push(ref.url);
  if (ref?.blobId) {
    for (const gw of FALLBACK_IPFS_GATEWAYS) {
      candidates.push(`${gw}/${ref.blobId}`);
    }
  }
  if (rawUrl && !candidates.includes(rawUrl)) candidates.push(rawUrl);

  for (const candidate of candidates) {
    const dataUrl = await fetchRasterDataUrl(candidate);
    if (dataUrl) return dataUrl;
  }
  return null;
}

// Bone-on-ink palette, mirroring globals.css.
const BONE = "#F5F1E8";
const INK = "#1A1A1A";
const INK_70 = "rgba(26,26,26,0.7)";
const INK_45 = "rgba(26,26,26,0.45)";
const INK_15 = "rgba(26,26,26,0.15)";

const ACCENT = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
} as const;
type AccentKey = keyof typeof ACCENT;

const CATEGORY_ACCENT: Record<string, AccentKey> = {
  art: "saffron",
  music: "saffron",
  meme: "saffron",
  infra: "poppy",
  rwa: "sun",
  dao: "jade",
  social: "jade",
  research: "sky",
  gaming: "plum",
};

function formatSui(mist: bigint): string {
  // Two decimals is enough for OG legibility — full precision lives on the page.
  const n = Number(mist) / 1e9;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M SUI`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K SUI`;
  if (n >= 1) return `${n.toFixed(2)} SUI`;
  return `${n.toFixed(4)} SUI`;
}

function formatPct(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

/**
 * Dynamic Open Graph image for `/projects/[projectId]`. Rendered on demand at request
 * time by Next's metadata file convention — both `og:image` and `twitter:image`
 * are auto-wired, so we don't need to list it in `generateMetadata`.
 *
 * Design: bone surface, hairline structure, cover image on the right, project
 * name + tagline + raise stats on the left. Category pill takes its color
 * from the same semantic map as the live project hero.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, logoDataUrl] = await Promise.all([
    getOnchainProject(projectId),
    getLogoDataUrl(),
  ]);

  // Graceful fallback — a missing project should still produce a valid PNG so
  // social crawlers don't 500 on a stale link.
  if (!project) {
    return new ImageResponse(
      (
        <div
          style={{
            ...rootStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            color: INK,
          }}
        >
          Project not found · pandabox.money
        </div>
      ),
      size,
    );
  }

  const safeBaseRate = BigInt(project.baseRate || 1);
  const raisedMist = project.sold / safeBaseRate;
  const pct =
    project.fundingAllocation > 0n
      ? Math.min(
          100,
          Math.max(
            0,
            Number((project.sold * 10_000n) / project.fundingAllocation) / 100,
          ),
        )
      : 0;

  const ended = project.endTimeMs > 0 && Date.now() > project.endTimeMs;
  const live = project.status === "live" && !ended;
  const statusLabel = live ? "LIVE" : ended ? "ENDED" : "CLOSED";
  const statusAccent: AccentKey = live ? "saffron" : "plum";

  const rawCategory = (project.details?.category ?? "project").toLowerCase();
  const categoryAccent: AccentKey = CATEGORY_ACCENT[rawCategory] ?? "saffron";

  const tagline = (project.details?.tagline ?? "").trim();
  const coverRef = resolveBlobRef(project.iconUrl);
  const coverDataUrl = await loadCoverDataUrl(coverRef, project.iconUrl ?? "");

  return new ImageResponse(
    (
      <div style={rootStyle}>
        {/* ── Top strip: brand + status ───────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 48px",
            borderBottom: `1px solid ${INK_15}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt=""
                width={40}
                height={40}
                style={{ width: 40, height: 40 }}
              />
            )}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                letterSpacing: 2,
                color: INK,
              }}
            >
              PANDABOX
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              background: `${ACCENT[statusAccent]}26`,
              fontFamily: "monospace",
              fontSize: 14,
              letterSpacing: 2,
              color: INK,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: ACCENT[statusAccent],
              }}
            />
            {statusLabel} · SUI MAINNET
          </div>
        </div>

        {/* ── Body: identity left, cover right ────────────────────────── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "40px 48px",
            gap: 40,
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            {/* Category pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: `${ACCENT[categoryAccent]}26`,
                alignSelf: "flex-start",
                fontFamily: "monospace",
                fontSize: 14,
                letterSpacing: 2,
                color: INK,
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: ACCENT[categoryAccent],
                }}
              />
              {rawCategory}
            </div>

            {/* Project name */}
            <div
              style={{
                marginTop: 24,
                fontSize: project.name.length > 22 ? 56 : 72,
                fontWeight: 600,
                lineHeight: 1,
                color: INK,
                letterSpacing: -1,
                display: "flex",
              }}
            >
              {project.name}
            </div>

            {/* Tagline */}
            {tagline && (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 22,
                  lineHeight: 1.3,
                  color: INK_70,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {tagline}
              </div>
            )}

            {/* Spacer pushes the stats row to the bottom of the column */}
            <div style={{ flex: 1, display: "flex" }} />

            {/* Stats: raised + percent */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderTop: `1px solid ${INK_15}`,
                paddingTop: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  paddingRight: 32,
                  borderRight: `1px solid ${INK_15}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: 2,
                    color: INK_45,
                  }}
                >
                  RAISED
                </span>
                <span
                  style={{
                    marginTop: 6,
                    fontFamily: "monospace",
                    fontSize: 36,
                    color: INK,
                  }}
                >
                  {formatSui(raisedMist)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: 32,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: 2,
                    color: INK_45,
                  }}
                >
                  % RAISED
                </span>
                <span
                  style={{
                    marginTop: 6,
                    fontFamily: "monospace",
                    fontSize: 36,
                    color: INK,
                  }}
                >
                  {formatPct(pct)}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: cover image */}
          <div
            style={{
              width: 380,
              height: 380,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${INK_15}`,
              background: BONE,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {coverDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverDataUrl}
                alt=""
                width={380}
                height={380}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  letterSpacing: 2,
                  color: INK_45,
                }}
              >
                NO COVER
              </span>
            )}
          </div>
        </div>

        {/* ── Bottom strip: URL + tagline ─────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 48px",
            borderTop: `1px solid ${INK_15}`,
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: 1.5,
            color: INK_70,
          }}
        >
          <span>pandabox.money/projects/{shortId(project.id)}</span>
          <span>PROGRAMMABLE FUNDING · SUI</span>
        </div>
      </div>
    ),
    size,
  );
}

const rootStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: BONE,
  color: INK,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

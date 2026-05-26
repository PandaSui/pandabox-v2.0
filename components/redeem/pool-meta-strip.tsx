import { getTranslations } from "next-intl/server";
import { Address } from "@/components/identity/address";
import { CoinType } from "@/components/identity/coin-type";
import { explorerUrl } from "@/lib/sui";
import { REDEEM_PLATFORM_ID } from "@/lib/contracts/redeem";
import type { HydratedPool } from "@/lib/redeem/discovery";
import { RecipientBadge } from "./recipient-badge";

/**
 * Full-width metadata strip that sits between the hero and the body —
 * a single horizontal band of mono-truncated identifiers (pool, coin,
 * recipient, creator, platform) plus a Suiscan link.
 *
 * Replaces the heavy `<PoolMetaPanel>` left-rail card. Crypto-natives
 * tend to scan this metadata once, copy what they need, and move on —
 * so giving it a dense one-line band is a better use of the rail-space
 * than a 5-row card. On narrow viewports the cells wrap to multiple
 * rows; the hairline-divided rhythm survives because each cell carries
 * its own `border-r` that we strip on the last child via `last:border-r-0`.
 */
export async function PoolMetaStrip({ data }: { data: HydratedPool }) {
  const { pool } = data;
  const t = await getTranslations("redeem.detail.meta");
  return (
    <aside
      aria-label={t("title")}
      className="border-b border-ink/15 bg-bone"
    >
      <ul className="mx-auto flex flex-wrap items-stretch divide-x divide-ink/15">
        <Cell label={t("poolId")}>
          <Address value={pool.objectId} />
        </Cell>
        <Cell label={t("coinType")}>
          <CoinType value={pool.coinType} />
        </Cell>
        <Cell label={t("recipient")}>
          <div className="flex items-center gap-2">
            <RecipientBadge mode={pool.recipientMode} size="sm" />
            <Address value={pool.recipient} />
          </div>
        </Cell>
        <Cell label={t("creator")}>
          <Address value={pool.creator} />
        </Cell>
        <Cell label={t("platform")}>
          <Address value={REDEEM_PLATFORM_ID} />
        </Cell>
        <li className="flex flex-1 items-center justify-end px-5 py-3.5">
          <a
            href={explorerUrl("object", pool.objectId)}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
          >
            <span>{t("viewSuiscan")}</span>
            <span
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-[2px]"
            >
              ↗
            </span>
          </a>
        </li>
      </ul>
    </aside>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1 px-5 py-3.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/45">
        {label}
      </span>
      <span className="min-w-0 text-[12.5px]">{children}</span>
    </li>
  );
}

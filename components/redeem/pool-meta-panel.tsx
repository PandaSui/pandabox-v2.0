import { getTranslations } from "next-intl/server";
import { Address } from "@/components/identity/address";
import { CoinType } from "@/components/identity/coin-type";
import { MonoLabel } from "@/components/primitives/mono-label";
import { explorerUrl } from "@/lib/sui";
import { REDEEM_PLATFORM_ID } from "@/lib/contracts/redeem";
import type { HydratedPool } from "@/lib/redeem/discovery";
import { RecipientBadge } from "./recipient-badge";

/**
 * Left-rail metadata panel — addresses, identifiers, and explorer links
 * for every object a crypto-native cares about: the pool, the platform,
 * the coin type, the creator, and the recipient. Every row is one tap
 * away from Suiscan; copy-to-clipboard is handled by the identity
 * primitives.
 */
export async function PoolMetaPanel({ data }: { data: HydratedPool }) {
  const { pool } = data;
  const t = await getTranslations("redeem.detail.meta");
  return (
    <aside className="border border-ink/15 bg-bone">
      <header className="border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
      </header>

      <dl className="divide-y divide-ink/10 px-5 py-2">
        <Row label={t("poolId")}>
          <Address value={pool.objectId} />
        </Row>
        <Row label={t("coinType")}>
          <CoinType value={pool.coinType} />
        </Row>
        <Row label={t("recipient")}>
          <div className="flex flex-col items-start gap-1.5">
            <RecipientBadge mode={pool.recipientMode} size="sm" />
            <Address value={pool.recipient} />
          </div>
        </Row>
        <Row label={t("creator")}>
          <Address value={pool.creator} />
        </Row>
        <Row label={t("platform")}>
          <Address value={REDEEM_PLATFORM_ID} />
        </Row>
      </dl>

      <footer className="border-t border-ink/15 px-5 py-3">
        <a
          href={explorerUrl("object", pool.objectId)}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
        >
          <span>{t("viewSuiscan")}</span>
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-[2px]">
            ↗
          </span>
        </a>
      </footer>
    </aside>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[12px]">{children}</dd>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { MonoLabel } from "@/components/primitives/mono-label";
import type { HydratedPool } from "@/lib/redeem/discovery";

/**
 * "About this pool" panel — the trust copy holders read before signing.
 * Three short blocks: how it works (mode-aware), permanence, fee. Plain
 * prose, hairline-bordered. Translated copy comes from next-intl; the
 * `<code>` and `<strong>` tags inside the long strings are rendered via
 * `t.rich` so they pick up the right styles in every locale.
 */
export async function AboutPool({
  data,
  feeBps,
}: {
  data: HydratedPool;
  feeBps: number;
}) {
  const { pool, metadata } = data;
  const symbol = metadata.symbol;
  const feePct = (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2);

  const t = await getTranslations("redeem.detail.about");

  const summaryKey =
    pool.recipientMode === "burn" ? "burnSummary" : "buybackSummary";

  return (
    <section className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          {t("permanentTerms")}
        </span>
      </header>

      <div className="space-y-5 px-5 py-5">
        <Block heading={t("howHeading")}>
          <p className="text-[14px] leading-relaxed text-ink/75">
            {t(summaryKey, { symbol })}
          </p>
        </Block>

        <Block heading={t("permanenceHeading")}>
          <p className="text-[14px] leading-relaxed text-ink/75">
            {t.rich("permanenceBody", {
              code: (chunks) => (
                <code className="font-mono text-[12.5px] text-ink">{chunks}</code>
              ),
            })}
          </p>
        </Block>

        <Block heading={t("feeHeading")}>
          <p className="text-[14px] leading-relaxed text-ink/75">
            {t.rich("feeBody", {
              fee: feePct,
              strong: (chunks) => (
                <strong className="font-mono font-semibold text-ink">
                  {chunks}
                </strong>
              ),
            })}
          </p>
        </Block>
      </div>
    </section>
  );
}

function Block({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink/65">
        {heading}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

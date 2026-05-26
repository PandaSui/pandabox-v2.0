import { getTranslations } from "next-intl/server";
import { MonoLabel } from "@/components/primitives/mono-label";
import { AccentRule } from "@/components/primitives/accent-rule";
import type { HydratedPool } from "@/lib/redeem/discovery";

/**
 * "About this pool" — the trust copy holders read before signing. Three
 * short blocks: how it works (mode-aware), permanence, fee.
 *
 * Renders as left-rail editorial prose, *not* a bordered card. The page's
 * old layout boxed this into a panel with its own header and divider,
 * which made trust copy compete visually with the activity feed and
 * redeem form. Stripping the chrome keeps the same information density
 * but reads as context rather than chrome.
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
    <section aria-label={t("title")}>
      <AccentRule color="sun">
        <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
      </AccentRule>

      <div className="mt-5 space-y-6">
        <Block heading={t("howHeading")}>
          <p className="text-[13.5px] leading-[1.6] text-ink/75">
            {t(summaryKey, { symbol })}
          </p>
        </Block>

        <Block heading={t("permanenceHeading")}>
          <p className="text-[13.5px] leading-[1.6] text-ink/75">
            {t.rich("permanenceBody", {
              code: (chunks) => (
                <code className="font-mono text-[12px] text-ink">{chunks}</code>
              ),
            })}
          </p>
        </Block>

        <Block heading={t("feeHeading")}>
          <p className="text-[13.5px] leading-[1.6] text-ink/75">
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
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55">
        {heading}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

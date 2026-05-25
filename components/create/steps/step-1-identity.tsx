"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWizard } from "@/lib/store/wizard";
import { StepIdentity, type IdentityV } from "@/lib/store/wizard-schema";
import { Field, TextArea, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { ImageUpload } from "../image-upload";
import { cn } from "@pandasui/ui/lib";
import type { Category } from "@/types/pandabox";

const CATEGORY_VALUES: Category[] = [
  "opc",
  "art",
  "infra",
  "meme",
  "dao",
  "research",
  "gaming",
  "music",
  "social",
  "rwa",
];

export function StepIdentityForm() {
  const t = useTranslations("create.step1");
  const tCat = useTranslations("explore.categories");
  const identity = useWizard((s) => s.draft.identity);
  const patch = useWizard((s) => s.patchIdentity);
  const errors = useMemo(() => parseErrors(identity), [identity]);

  const tagLen = (identity.tagline ?? "").length;
  const descLen = (identity.description ?? "").length;

  return (
    <div className="space-y-8">
      <StepHeader
        n={1}
        accent="saffron"
        title={t("title")}
        body={t("body")}
        meta={t("meta")}
      />

      <StepCard title={t("basicsTitle")} meta={t("basicsMeta")}>
        <Field label={t("projectName")} error={errors.name}>
          {(id) => (
            <TextField
              id={id}
              value={identity.name ?? ""}
              onChange={(v) => patch({ name: v })}
              placeholder={t("projectNamePlaceholder")}
              maxLength={60}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label={t("ticker")}
            hint={t("tickerHint")}
            error={errors.ticker}
          >
            {(id) => (
              <TextField
                id={id}
                value={identity.ticker ?? ""}
                onChange={(v) =>
                  patch({ ticker: v.toUpperCase().replace(/[^A-Z0-9]/g, "") })
                }
                placeholder="OONO"
                maxLength={10}
              />
            )}
          </Field>
          <Field label={t("category")} error={errors.category}>
            {(id) => (
              <div className="flex flex-wrap gap-1.5" id={id}>
                {CATEGORY_VALUES.map((value) => {
                  const active = value === identity.category;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch({ category: value })}
                      aria-pressed={active}
                      className={cn(
                        "px-3 py-1.5 font-mono-label transition-all duration-200 ease-atelier border",
                        active
                          ? "border-ink bg-ink text-bone shadow-offset-sm"
                          : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                      )}
                    >
                      {tCat(value)}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
      </StepCard>

      <StepCard title={t("storyTitle")} meta={t("storyMeta")}>
        <Field
          label={t("tagline")}
          hint={t("taglineHint", { len: tagLen })}
          error={errors.tagline}
        >
          {(id) => (
            <TextField
              id={id}
              value={identity.tagline ?? ""}
              onChange={(v) => patch({ tagline: v })}
              placeholder={t("taglinePlaceholder")}
              maxLength={160}
            />
          )}
        </Field>

        <Field
          label={t("description")}
          hint={t("descriptionHint", { len: descLen })}
          error={errors.description}
        >
          {(id) => (
            <TextArea
              id={id}
              value={identity.description ?? ""}
              onChange={(v) => patch({ description: v })}
              rows={9}
              maxLength={4000}
              placeholder={t("descriptionPlaceholder")}
            />
          )}
        </Field>
      </StepCard>

      <StepCard title={t("coverTitle")} meta={t("coverMeta")}>
        <ImageUpload
          label={t("coverTitle")}
          value={identity.coverImage}
          onChange={(v) =>
            patch({
              coverImage: v?.url ?? "",
              coverImageCid: v?.cid ?? "",
            })
          }
          hint={t("coverHint")}
        />
      </StepCard>

      <StepCard title={t("socialsTitle")} meta={t("socialsMeta")}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field label={t("twitter")}>
            {(id) => (
              <TextField
                id={id}
                value={identity.twitter ?? ""}
                onChange={(v) => patch({ twitter: v })}
                placeholder={t("twitterPlaceholder")}
              />
            )}
          </Field>
          <Field label={t("website")}>
            {(id) => (
              <TextField
                id={id}
                value={identity.website ?? ""}
                onChange={(v) => patch({ website: v })}
                placeholder={t("websitePlaceholder")}
              />
            )}
          </Field>
          <Field label={t("discord")}>
            {(id) => (
              <TextField
                id={id}
                value={identity.discord ?? ""}
                onChange={(v) => patch({ discord: v })}
                placeholder={t("discordPlaceholder")}
              />
            )}
          </Field>
        </div>
      </StepCard>
    </div>
  );
}

function parseErrors(identity: Partial<IdentityV>) {
  const out: Record<string, string | undefined> = {};
  if (identity.name && identity.name.length > 0) {
    const r = StepIdentity.shape.name.safeParse(identity.name);
    if (!r.success) out.name = r.error.issues[0]?.message;
  }
  if (identity.ticker && identity.ticker.length > 0) {
    const r = StepIdentity.shape.ticker.safeParse(identity.ticker);
    if (!r.success) out.ticker = r.error.issues[0]?.message;
  }
  if (identity.tagline && identity.tagline.length > 0) {
    const r = StepIdentity.shape.tagline.safeParse(identity.tagline);
    if (!r.success) out.tagline = r.error.issues[0]?.message;
  }
  if (identity.description && identity.description.length > 0) {
    const r = StepIdentity.shape.description.safeParse(identity.description);
    if (!r.success) out.description = r.error.issues[0]?.message;
  }
  return out;
}

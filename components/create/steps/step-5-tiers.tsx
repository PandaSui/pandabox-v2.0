"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField, TextArea, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { ImageUpload } from "../image-upload";
import { Diecut } from "@/components/primitives/diecut";
import { cn } from "@pandasui/ui/lib";
import type { TierV } from "@/lib/store/wizard-schema";

const MIST = 1_000_000_000n;

function emptyTier(): TierV {
  return {
    id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    priceMist: (1n * MIST).toString(),
    maxSupply: 0,
    perks: "",
  };
}

export function StepTiersForm() {
  const tiers = useWizard((s) => s.draft.tiers);
  const setEnabled = useWizard((s) => s.setTiersEnabled);
  const upsert = useWizard((s) => s.upsertTier);
  const remove = useWizard((s) => s.removeTier);

  return (
    <div className="space-y-8">
      <StepHeader
        n={5}
        accent="sky"
        title="NFT tiers"
        body="Optional. Up to 10 tiers — paying ≥ tier price mints the tier NFT in addition to the project tokens. Each tier can have its own art."
        meta={tiers.enabled ? `${tiers.list.length}/10 configured` : "skipped"}
      />

      <div className="flex items-center justify-between border border-ink/15 bg-bone px-5 py-4">
        <div>
          <p className="font-mono-label text-[10px] text-ink/55">
            Mode
          </p>
          <p className="mt-0.5 text-sm">
            {tiers.enabled
              ? "Tiers enabled — define at least one tier below"
              : "Tiers skipped — supporters receive project tokens only"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!tiers.enabled)}
          aria-pressed={tiers.enabled}
        >
          <Diecut
            className={cn(
              "border px-4 py-2 font-mono-label transition-all duration-200 ease-atelier shadow-offset-sm",
              tiers.enabled
                ? "border-ink bg-ink text-bone"
                : "border-ink/40 hover:border-ink hover:-translate-y-[1px]",
            )}
          >
            {tiers.enabled ? "Skip tiers" : "Add tiers"}
          </Diecut>
        </button>
      </div>

      {tiers.enabled && (
        <div className="space-y-5">
          {tiers.list.length === 0 && (
            <p className="border border-dashed border-ink/25 bg-bone/40 px-5 py-8 text-center text-sm text-ink/55">
              No tiers yet. Add one below.
            </p>
          )}

          {tiers.list.map((t, idx) => (
            <TierEditor
              key={t.id}
              tier={t}
              index={idx}
              onChange={(next) => upsert(next)}
              onRemove={() => remove(t.id)}
            />
          ))}

          {tiers.list.length < 10 && (
            <button
              type="button"
              onClick={() => upsert(emptyTier())}
              className="group w-full border border-dashed border-ink/30 py-4 font-mono-label text-ink/60 transition-all duration-200 ease-atelier hover:border-ink hover:text-ink hover:bg-bone/50"
            >
              + add tier {String(tiers.list.length + 1).padStart(2, "0")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TierEditor({
  tier,
  index,
  onChange,
  onRemove,
}: {
  tier: TierV;
  index: number;
  onChange: (t: TierV) => void;
  onRemove: () => void;
}) {
  const priceSui = Number(BigInt(tier.priceMist || "0")) / 1e9;

  return (
    <StepCard
      title={`Tier 0${index + 1}`}
      meta={tier.name ? `"${tier.name}"` : "untitled"}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_180px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Name">
              {(id) => (
                <TextField
                  id={id}
                  value={tier.name}
                  onChange={(v) => onChange({ ...tier, name: v })}
                  placeholder="Print · Founder · Patron"
                  maxLength={32}
                />
              )}
            </Field>
            <Field label="Price" hint="SUI required to claim this tier">
              {() => (
                <NumberField
                  value={priceSui}
                  onChange={(v) =>
                    onChange({
                      ...tier,
                      priceMist: BigInt(
                        Math.round(Math.max(0, v) * 1e9),
                      ).toString(),
                    })
                  }
                  min={0}
                  step={0.1}
                  suffix="SUI"
                />
              )}
            </Field>
          </div>

          <Field label="Max supply" hint="0 = unlimited">
            {() => (
              <NumberField
                value={tier.maxSupply}
                onChange={(v) =>
                  onChange({ ...tier, maxSupply: Math.max(0, Math.round(v)) })
                }
                min={0}
                step={1}
                suffix="MINTS"
              />
            )}
          </Field>

          <Field
            label="Perks"
            hint="One-line description visible on the project page"
          >
            {(id) => (
              <TextArea
                id={id}
                value={tier.perks}
                onChange={(v) => onChange({ ...tier, perks: v })}
                rows={2}
                maxLength={280}
                placeholder="Signed print edition + tokens."
              />
            )}
          </Field>
        </div>

        <div>
          <ImageUpload
            variant="tile"
            label="Art"
            value={tier.image}
            onChange={(v) =>
              onChange({
                ...tier,
                image: v?.url ?? "",
                imageCid: v?.cid ?? "",
              })
            }
            hint="Square crop · pinned to IPFS"
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-ink/10 pt-3">
        <button
          type="button"
          onClick={onRemove}
          className="font-mono-label text-[10px] text-ink/45 hover:text-poppy"
        >
          remove tier
        </button>
      </div>
    </StepCard>
  );
}

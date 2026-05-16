"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField, TextArea, TextField } from "../field";
import { MonoLabel } from "@/components/primitives/mono-label";
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <MonoLabel>Step 05</MonoLabel>
          <h2 className="mt-1 text-3xl">NFT tiers</h2>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            Optional. Up to 10 tiers — paying ≥ tier price mints the tier NFT
            in addition to the project tokens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!tiers.enabled)}
          aria-pressed={tiers.enabled}
        >
          <Diecut
            className={cn(
              "border px-4 py-2 transition-colors",
              tiers.enabled
                ? "border-ink bg-ink text-bone"
                : "border-ink/40 hover:border-ink",
            )}
          >
            <span className="font-mono-label">
              {tiers.enabled ? "Skip tiers" : "Add tiers"}
            </span>
          </Diecut>
        </button>
      </div>

      {!tiers.enabled ? (
        <p className="border border-ink/15 bg-paper/40 px-5 py-8 text-center text-sm text-ink/55">
          No tiers — supporters receive project tokens only.
        </p>
      ) : (
        <div className="space-y-4">
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
              className="w-full border border-dashed border-ink/30 py-4 font-mono-label text-ink/60 hover:border-ink hover:text-ink"
            >
              + add tier {tiers.list.length + 1}
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
    <div className="border border-ink/15 bg-bone/40 p-5">
      <div className="flex items-baseline justify-between">
        <MonoLabel>Tier 0{index + 1}</MonoLabel>
        <button
          type="button"
          onClick={onRemove}
          className="font-mono-label text-ink/45 hover:text-poppy"
        >
          remove
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <TextField
              id={id}
              value={tier.name}
              onChange={(v) => onChange({ ...tier, name: v })}
              placeholder="Print, Founder, Patron"
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

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <Field label="Image URL (optional)">
          {(id) => (
            <TextField
              id={id}
              value={tier.image ?? ""}
              onChange={(v) => onChange({ ...tier, image: v })}
              placeholder="/panda-logo.webp"
            />
          )}
        </Field>
      </div>

      <Field
        label="Perks"
        hint="One-line description visible on the project page"
        className="mt-4"
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
  );
}

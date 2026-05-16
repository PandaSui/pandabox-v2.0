"use client";

import { useMemo } from "react";
import { useWizard } from "@/lib/store/wizard";
import { StepIdentity, type IdentityV } from "@/lib/store/wizard-schema";
import { Field, TextArea, TextField } from "../field";
import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";
import type { Category } from "@/types/pandabox";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "art", label: "Art" },
  { value: "infra", label: "Infra" },
  { value: "dao", label: "DAO" },
  { value: "research", label: "Research" },
  { value: "gaming", label: "Gaming" },
  { value: "music", label: "Music" },
  { value: "social", label: "Social" },
  { value: "rwa", label: "RWA" },
];

export function StepIdentityForm() {
  const identity = useWizard((s) => s.draft.identity);
  const patch = useWizard((s) => s.patchIdentity);
  const errors = useMemo(() => parseErrors(identity), [identity]);

  return (
    <div className="space-y-6">
      <Header
        n="01"
        title="Identity"
        body="Who is funding what. This is what supporters see in their wallet and on the project page."
      />

      <Field label="Project name" error={errors.name}>
        {(id) => (
          <TextField
            id={id}
            value={identity.name ?? ""}
            onChange={(v) => patch({ name: v })}
            placeholder="e.g. Atelier Ono"
            maxLength={60}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field
          label="Ticker"
          hint="Uppercase letters/digits, 2–10 chars"
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
        <Field label="Category" error={errors.category}>
          {(id) => (
            <div className="flex flex-wrap gap-1.5" id={id}>
              {CATEGORIES.map((c) => {
                const active = c.value === identity.category;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => patch({ category: c.value })}
                    aria-pressed={active}
                    className={cn(
                      "px-3 py-1.5 font-mono-label transition-colors border",
                      active
                        ? "border-ink bg-ink text-bone"
                        : "border-ink/25 hover:border-ink",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </div>

      <Field label="Tagline" hint="One line, 8–160 chars" error={errors.tagline}>
        {(id) => (
          <TextField
            id={id}
            value={identity.tagline ?? ""}
            onChange={(v) => patch({ tagline: v })}
            placeholder="A photo-zine collective minting weekly drops on Sui."
            maxLength={160}
          />
        )}
      </Field>

      <Field
        label="Description"
        hint="Markdown supported; 20–4000 chars"
        error={errors.description}
      >
        {(id) => (
          <TextArea
            id={id}
            value={identity.description ?? ""}
            onChange={(v) => patch({ description: v })}
            rows={8}
            maxLength={4000}
            placeholder="Tell supporters what you're building and why their SUI matters."
          />
        )}
      </Field>

      <Field label="Cover image URL" hint="Paste a hosted image URL or path">
        {(id) => (
          <TextField
            id={id}
            value={identity.coverImage ?? ""}
            onChange={(v) => patch({ coverImage: v })}
            placeholder="/panda-logo.webp"
          />
        )}
      </Field>

      <div>
        <MonoLabel className="block">Socials (optional)</MonoLabel>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="X / Twitter">
            {(id) => (
              <TextField
                id={id}
                value={identity.twitter ?? ""}
                onChange={(v) => patch({ twitter: v })}
                placeholder="handle"
              />
            )}
          </Field>
          <Field label="Website">
            {(id) => (
              <TextField
                id={id}
                value={identity.website ?? ""}
                onChange={(v) => patch({ website: v })}
                placeholder="domain.com"
              />
            )}
          </Field>
          <Field label="Discord">
            {(id) => (
              <TextField
                id={id}
                value={identity.discord ?? ""}
                onChange={(v) => patch({ discord: v })}
                placeholder="invite URL"
              />
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}

function Header({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <MonoLabel>Step {n}</MonoLabel>
      <h2 className="mt-1 text-3xl">{title}</h2>
      <p className="mt-2 max-w-prose text-sm text-ink/65">{body}</p>
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

"use client";

import { useEffect, useState } from "react";
import { useWizard } from "@/lib/store/wizard";
import { ProjectHero } from "@/components/project/project-hero";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Diecut } from "@/components/primitives/diecut";
import { SuiAmount } from "@/components/identity/sui-amount";
import { draftToProject } from "./draft-to-project";
import type { ProjectDTO } from "@/lib/api/project-dto";

const DEBOUNCE_MS = 300;

export function PreviewPane({ className }: { className?: string }) {
  const draft = useWizard((s) => s.draft);
  const [snapshot, setSnapshot] = useState<ProjectDTO | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSnapshot(draftToProject(draft));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft]);

  if (!snapshot) {
    return (
      <div className={className}>
        <PreviewHeader />
        <div className="border border-ink/15 p-6 text-sm text-ink/55">
          Building preview…
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <PreviewHeader />
      <div className="border border-ink/15 overflow-hidden">
        <ProjectHero project={snapshot} />
        <ParamsSummary project={snapshot} />
        {snapshot.tiers.length > 0 && <TiersPreview project={snapshot} />}
      </div>
    </div>
  );
}

function PreviewHeader() {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <MonoLabel>Live preview</MonoLabel>
      <span className="font-mono-label text-[10px] text-ink/40">
        what supporters see
      </span>
    </div>
  );
}

function ParamsSummary({ project }: { project: ProjectDTO }) {
  return (
    <div className="grid grid-cols-2 border-t border-ink/15 md:grid-cols-4">
      <Cell label="Reserved" value={`${project.params.reservedRate}%`} />
      <Cell label="Cash-out tax" value={`${project.params.cashOutTax}%`} border />
      <Cell label="Issuance ↓" value={`${project.params.issuanceReduction}%`} border />
      <Cell
        label="Payout limit"
        valueNode={
          <SuiAmount
            mist={BigInt(project.params.payoutLimitMist)}
            compact
            maxFractionDigits={1}
            className="text-sm"
          />
        }
        border
      />
    </div>
  );
}

function Cell({
  label,
  value,
  valueNode,
  border = false,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={border ? "border-l border-ink/15 p-4" : "p-4"}>
      <span className="font-mono-label text-[10px] text-ink/50 block">
        {label}
      </span>
      <div className="mt-1 font-mono tabular-nums text-sm">
        {valueNode ?? value}
      </div>
    </div>
  );
}

function TiersPreview({ project }: { project: ProjectDTO }) {
  return (
    <div className="border-t border-ink/15 p-5">
      <MonoLabel className="block">Tiers</MonoLabel>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {project.tiers.map((t) => (
          <Diecut
            key={t.id}
            className="border border-ink/15 bg-bone/40 p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{t.name}</span>
              <SuiAmount mist={BigInt(t.priceMist)} maxFractionDigits={2} className="text-xs" />
            </div>
            {t.perks && (
              <p className="mt-1.5 text-xs text-ink/60">{t.perks}</p>
            )}
            <div className="mt-2 font-mono text-[10px] text-ink/45">
              {t.maxSupply > 0
                ? `0/${t.maxSupply} minted`
                : "unlimited supply"}
            </div>
          </Diecut>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { Modal } from "@pandasui/ui";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TokenAmount } from "@/components/identity/token-amount";
import type { CycleDTO } from "@/lib/api/project-dto";

const ACCENT_BORDER: Record<CycleDTO["status"], string> = {
  past: "border-plum/60",
  current: "border-saffron",
  upcoming: "border-sky/60",
};

const ACCENT_TEXT: Record<CycleDTO["status"], string> = {
  past: "text-plum",
  current: "text-saffron",
  upcoming: "text-sky",
};

const DAY_MS = 86400_000;

function dateRange(start: number, end: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toISOString().slice(5, 10).replace("-", "/");
  return `${fmt(start)} → ${fmt(end)}`;
}

export function CycleStepper({ cycles, ticker }: { cycles: CycleDTO[]; ticker: string }) {
  const [openCycle, setOpenCycle] = useState<CycleDTO | null>(null);

  return (
    <div className="space-y-3">
      <MonoLabel>Cycles</MonoLabel>
      <div className="scrollbar-slim -mx-2 flex gap-3 overflow-x-auto px-2 pb-2">
        {cycles.map((c) => (
          <CycleCard
            key={c.number}
            cycle={c}
            onOpen={() => setOpenCycle(c)}
          />
        ))}
      </div>

      <Modal
        open={openCycle != null}
        onClose={() => setOpenCycle(null)}
        title={openCycle ? `Cycle Nº${openCycle.number}` : undefined}
      >
        {openCycle && (
          <div className="space-y-4 text-sm">
            <Row label="Status">
              <span className={cn("font-mono-label", ACCENT_TEXT[openCycle.status])}>
                {openCycle.status}
              </span>
            </Row>
            <Row label="Window">
              <span className="font-mono">{dateRange(openCycle.start, openCycle.end)}</span>
            </Row>
            <Row label="Duration">
              <span className="font-mono">
                {Math.round((openCycle.end - openCycle.start) / DAY_MS)}d
              </span>
            </Row>
            <Row label="Raised">
              <SuiAmount mist={BigInt(openCycle.raisedMist)} maxFractionDigits={2} />
            </Row>
            <Row label="Payouts">
              <SuiAmount mist={BigInt(openCycle.payoutsMist)} maxFractionDigits={2} />
            </Row>
            <Row label="Reserved tokens">
              <TokenAmount
                raw={openCycle.reservedTokensRaw}
                decimals={9}
                ticker={ticker}
                compact
              />
            </Row>
            <hr className="border-ink/15" />
            <Row label="Weight">
              <span className="font-mono">
                {openCycle.params.weight} tokens / SUI
              </span>
            </Row>
            <Row label="Reserved rate">
              <span className="font-mono">{openCycle.params.reservedRate}%</span>
            </Row>
            <Row label="Cash-out tax">
              <span className="font-mono">{openCycle.params.cashOutTax}%</span>
            </Row>
            <Row label="Issuance reduction">
              <span className="font-mono">{openCycle.params.issuanceReduction}%</span>
            </Row>
            <Row label="Payout limit">
              <SuiAmount mist={BigInt(openCycle.params.payoutLimitMist)} compact />
            </Row>
            <Row label="Ballot delay">
              <span className="font-mono">
                {openCycle.params.ballotDelayHours}h
              </span>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CycleCard({
  cycle,
  onOpen,
}: {
  cycle: CycleDTO;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "min-w-[200px] shrink-0 border-l-2 bg-bone/40 px-4 py-3 text-left transition-colors",
        "hover:bg-bone",
        ACCENT_BORDER[cycle.status],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono-label text-ink/70">
          Cycle Nº{cycle.number}
        </span>
        {cycle.status === "current" ? (
          <Marker color="saffron">
            <span className="font-mono-label">current</span>
          </Marker>
        ) : (
          <span className={cn("font-mono-label text-[10px]", ACCENT_TEXT[cycle.status])}>
            {cycle.status}
          </span>
        )}
      </div>
      <div className="mt-2 font-mono text-xs text-ink/50">
        {dateRange(cycle.start, cycle.end)}
      </div>
      <div className="mt-3">
        <SuiAmount
          mist={BigInt(cycle.raisedMist)}
          compact
          maxFractionDigits={1}
          className="text-base"
          showGlyph={false}
        />
        <span className="ml-1 font-mono-label text-[10px] text-ink/40">RAISED</span>
      </div>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono-label text-[10px] text-ink/50">{label}</span>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import {
  PROTOCOLS,
  isProtocolId,
  type ProtocolId,
} from "@/lib/admin/protocols";
import type { DeckCard } from "@/lib/admin/overview";
import type { PlatformStats } from "@/lib/platform";
import type { RedeemPlatformState } from "@/lib/redeem/types";
import type { AirdropPlatformState } from "@/lib/airdrop/types";
import type { OnChainProject } from "@/lib/projects";
import { ControlDeck } from "./control-deck";
import { ProtocolSwitcher } from "./protocol-switcher";
import { AdminGate } from "./admin-gate";
import { PlatformStatePanel } from "./platform-state-panel";
import { RedeemStatePanel } from "./redeem-state-panel";
import { AirdropStatePanel } from "./airdrop-state-panel";
import { ProjectModerationTable } from "./project-moderation-table";
import { AdminCapCard } from "./admin-cap-card";

/**
 * Orchestrates the console: the live control deck, the protocol switcher, and
 * the active protocol's gated panel. The active tab lives in client state
 * (initialized from `?p=`) and writes back to the URL via `history` — so
 * switching is instant and refetch-free, but the URL stays shareable.
 */
export function AdminConsole({
  cards,
  platform,
  redeem,
  airdrop,
  projects,
}: {
  cards: DeckCard[];
  platform: PlatformStats | null;
  redeem: RedeemPlatformState | null;
  airdrop: AirdropPlatformState | null;
  projects: OnChainProject[];
}) {
  const params = useSearchParams();
  const fromUrl = params.get("p");
  const [active, setActive] = useState<ProtocolId>(
    isProtocolId(fromUrl) ? fromUrl : "pandabox",
  );

  const select = (id: ProtocolId) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("p", id);
    window.history.replaceState(null, "", url.toString());
  };

  const cfg = PROTOCOLS[active];

  return (
    <Container className="space-y-8 py-10">
      <ControlDeck cards={cards} active={active} onSelect={select} />

      <div className="flex flex-col gap-4 border-t border-ink/15 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <AccentRule color={cfg.accent}>
            <MonoLabel accent={cfg.accent}>{cfg.label}</MonoLabel>
          </AccentRule>
          <h2 className="mt-2 text-2xl text-ink">{cfg.tagline} controls</h2>
        </div>
        <ProtocolSwitcher active={active} onSelect={select} />
      </div>

      <AdminGate protocol={active}>
        {active === "pandabox" && (
          <div className="space-y-8">
            {platform ? (
              <PlatformStatePanel stats={platform} />
            ) : (
              <ReadFailure label="Pandabox" envVar="NEXT_PUBLIC_PLATFORM_OBJECT_ID" />
            )}
            <ProjectModerationTable projects={projects} />
            <AdminCapCard protocol="pandabox" />
          </div>
        )}

        {active === "redeem" && (
          <div className="space-y-8">
            {redeem ? (
              <RedeemStatePanel stats={redeem} />
            ) : (
              <ReadFailure label="Redeem" envVar="NEXT_PUBLIC_REDEEM_PLATFORM_ID" />
            )}
            <AdminCapCard protocol="redeem" />
          </div>
        )}

        {active === "airdrop" && (
          <div className="space-y-8">
            {airdrop ? (
              <AirdropStatePanel stats={airdrop} />
            ) : (
              <ReadFailure label="Airdrop" envVar="NEXT_PUBLIC_AIRDROP_PLATFORM_ID" />
            )}
            <AdminCapCard
              protocol="airdrop"
              airdropInitialSharedVersion={airdrop?.initialSharedVersion}
            />
          </div>
        )}
      </AdminGate>
    </Container>
  );
}

function ReadFailure({ label, envVar }: { label: string; envVar: string }) {
  return (
    <div className="border border-poppy/40 bg-poppy/[0.06] p-6 shadow-offset-sm">
      <MonoLabel accent="poppy">{label} platform read failed</MonoLabel>
      <p className="mt-2 text-sm text-ink/70">
        Couldn&apos;t read the {label} platform object. Either{" "}
        <code className="font-mono text-[12px]">{envVar}</code> isn&apos;t set,
        or the fullnode call failed. Cap actions below still work — they don&apos;t
        depend on platform state.
      </p>
    </div>
  );
}

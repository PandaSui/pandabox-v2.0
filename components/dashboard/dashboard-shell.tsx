"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { Diecut } from "@/components/primitives/diecut";
import { Frame } from "@/components/primitives/frame";
import { Hairline } from "@/components/primitives/hairline";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { ProjectRow } from "@/components/project";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TokenAmount } from "@/components/identity/token-amount";
import { RelativeTime } from "@/components/identity/relative-time";
import type { DashboardDTO } from "@/lib/api/dashboard-dto";

export function DashboardShell() {
  const account = useCurrentAccount();
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) {
      setData(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/dashboard/${account.address}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => r.json() as Promise<DashboardDTO>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [account]);

  if (!account) {
    return (
      <Container className="py-16">
        <Frame className="mx-auto max-w-xl text-center">
          <MonoLabel>Connect your wallet</MonoLabel>
          <p className="mt-3 text-sm text-ink/70">
            Your owned projects and supported projects will appear here once a
            Sui wallet is connected.
          </p>
          <div className="mt-5 flex justify-center">
            <ConnectWallet />
          </div>
        </Frame>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <header className="flex items-baseline justify-between border-b border-ink/15 pb-4">
        <div>
          <MonoLabel>Dashboard</MonoLabel>
          <h1 className="mt-1 text-3xl md:text-4xl">Your activity</h1>
        </div>
        <div className="text-right text-xs">
          <MonoLabel className="block text-[10px]">Connected as</MonoLabel>
          <Address value={account.address} link className="mt-1" />
        </div>
      </header>

      <section className="py-10">
        <SectionHeader
          title="Your projects"
          subtitle="Projects you've deployed — admin caps you hold."
          count={data?.owned.length}
        />
        {loading && !data ? (
          <Loading />
        ) : data && data.owned.length > 0 ? (
          <div className="space-y-2">
            {data.owned.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                right={
                  <Link
                    href={`/p/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono-label text-[10px] text-sky hover:text-ink"
                  >
                    Queue reconfig →
                  </Link>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            label="No projects yet"
            body="Spin up a project in twelve minutes. Configure cycles, payouts, tokens, optional NFT tiers, and deploy in one signature."
            href="/create"
            cta="Launch a project →"
          />
        )}
      </section>

      <Hairline />

      <section className="py-10">
        <SectionHeader
          title="Projects you support"
          subtitle="Token balances, current cash-out value, and your last payment."
          count={data?.supported.length}
        />
        {loading && !data ? (
          <Loading />
        ) : data && data.supported.length > 0 ? (
          <div className="space-y-2">
            {data.supported.map((s) => (
              <ProjectRow
                key={s.project.id}
                project={s.project}
                right={
                  <div className="space-y-2 text-right">
                    <Stat label="Balance">
                      <TokenAmount
                        raw={s.balanceRaw}
                        decimals={9}
                        ticker={s.project.ticker}
                        compact
                        className="text-sm"
                      />
                    </Stat>
                    <Stat label="Cash out today">
                      <SuiAmount
                        mist={BigInt(s.cashOutMist)}
                        compact
                        maxFractionDigits={2}
                        className="text-sm"
                      />
                    </Stat>
                    {s.lastPayment && (
                      <Stat label="Last payment">
                        <RelativeTime
                          value={s.lastPayment.timestamp}
                          className="text-xs"
                        />
                      </Stat>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            label="Not supporting anyone yet"
            body="Back a project to track your token balance, cash-out value, and last payment here."
            href="/explore"
            cta="Explore projects →"
          />
        )}
      </section>
    </Container>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between">
      <div>
        <h2 className="text-2xl">{title}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink/60">{subtitle}</p>
      </div>
      {typeof count === "number" && (
        <span className="font-mono tabular-nums text-sm text-ink/50">
          {count.toLocaleString()}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  label,
  body,
  href,
  cta,
}: {
  label: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="border border-dashed border-ink/20 bg-paper/40 px-6 py-10 text-center">
      <MonoLabel>{label}</MonoLabel>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-block"
      >
        <Diecut className="border border-ink px-5 py-2 hover:bg-ink hover:text-bone transition-colors">
          <span className="font-mono-label">{cta}</span>
        </Diecut>
      </Link>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse border border-ink/10 bg-ink/5"
        />
      ))}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="font-mono-label text-[9px] text-ink/45 block">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

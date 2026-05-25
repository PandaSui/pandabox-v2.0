"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useCurrentAccount,
  useCurrentWallet,
  useConnectWallet,
  useDisconnectWallet,
  useSuiClientQuery,
  useWallets,
} from "@mysten/dapp-kit";
import { useCoins } from "@/hooks/use-coins";
import type { WalletWithRequiredFeatures } from "@mysten/wallet-standard";
import { gsap, registerGsap } from "@pandasui/ui/lib";
import { Button } from "@pandasui/ui";
import { Modal } from "@pandasui/ui";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTokenBalance(raw: string | undefined, decimals = 9) {
  if (!raw) return "0.00";
  const n = Number(raw) / 10 ** decimals;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

const formatSui = formatTokenBalance;

export function ConnectWallet() {
  const t = useTranslations("wallet");
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const wallets = useWallets();
  const { mutate: connect, isPending: connecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { data: balance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address },
  );

  const { data: coins } = useCoins();
  const pansCoinType = coins?.find((c) => c.coin_symbol === "PANS")
    ?.coin_contract;
  const { data: pansBalance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "", coinType: pansCoinType ?? "" },
    { enabled: !!account?.address && !!pansCoinType },
  );

  useEffect(() => {
    registerGsap();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !menuRef.current) return;
    gsap.fromTo(
      menuRef.current,
      { y: -6, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.25, ease: "power3.out" },
    );
  }, [menuOpen]);

  async function handleCopy() {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function handleConnect(wallet: WalletWithRequiredFeatures) {
    setConnectError(null);
    connect(
      { wallet },
      {
        onSuccess: () => setPickerOpen(false),
        onError: (e) => setConnectError(e.message ?? t("connectError")),
      },
    );
  }

  if (!account) {
    return (
      <>
        <Button
          size="sm"
          variant="ink"
          trailing={<ArrowDiag size={12} />}
          onClick={() => setPickerOpen(true)}
        >
          {t("connect")}
        </Button>

        <Modal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={t("pickerTitle")}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink/60 leading-relaxed">
              {t("pickerDescription")}
            </p>

            {wallets.length === 0 ? (
              <div className="border border-dashed border-ink/25 rounded-lg p-5 text-sm text-ink/65">
                {t("noWallets")}
                <div className="mt-3">
                  <a
                    href="https://suiwallet.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono-label text-xs underline underline-offset-4"
                  >
                    {t("installSuiWallet")}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {wallets.map((w) => (
                  <button
                    key={w.name}
                    onClick={() => handleConnect(w)}
                    disabled={connecting}
                    className="group flex items-center gap-4 p-4 border border-ink/15 hover:border-ink hover:bg-ink hover:text-bone rounded-lg transition-colors text-left disabled:opacity-50"
                  >
                    {w.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.icon}
                        alt=""
                        className="w-9 h-9 rounded-md bg-bone border border-ink/10"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-md border border-ink/15 inline-flex items-center justify-center font-display">
                        {w.name[0]}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg leading-none">
                        {w.name}
                      </div>
                      <div className="font-mono-label text-[10px] opacity-60 mt-1">
                        {w.version ? `v${w.version}` : t("walletStandard")}
                      </div>
                    </div>
                    <ArrowDiag
                      size={14}
                      className="opacity-40 group-hover:opacity-100"
                    />
                  </button>
                ))}
              </div>
            )}

            {connectError ? (
              <div className="mt-2 text-xs text-poppy font-mono-label">
                {connectError}
              </div>
            ) : null}
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "group inline-flex items-center gap-2.5 h-9 px-3 border border-ink rounded-full bg-bone text-ink text-xs font-mono-label tracking-[0.1em] uppercase",
          "shadow-offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset transition-all duration-300",
        )}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="relative inline-flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-jade" />
          <span className="absolute inset-0 rounded-full bg-jade animate-ping opacity-60" />
        </span>
        <span className="tabular-nums">{shortAddr(account.address)}</span>
        <span className="h-4 w-px bg-ink/20" />
        <span className="tabular-nums text-ink/70">
          {formatTokenBalance(pansBalance?.totalBalance)} PANS
        </span>
        <span className="text-ink/25">·</span>
        <span className="tabular-nums text-ink/70">
          {formatSui(balance?.totalBalance)} SUI
        </span>
      </button>

      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-72 bg-bone border border-ink shadow-offset-lg z-50"
        >
          <div className="px-4 py-4 border-b border-ink/10 flex items-center gap-3">
            {currentWallet?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentWallet.icon}
                alt=""
                className="w-9 h-9 rounded-md border border-ink/10"
              />
            ) : (
              <span className="w-9 h-9 rounded-md border border-ink/20 inline-flex items-center justify-center font-display">
                {currentWallet?.name?.[0] ?? "W"}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg leading-none">
                {currentWallet?.name ?? t("fallbackName")}
              </div>
              <div className="font-mono-label text-[10px] text-ink/50 mt-1 truncate">
                {account.address}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-ink/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-label text-[10px] text-ink/50">
                {t("balanceLabel")}
              </span>
              <span className="font-mono-label text-[10px] text-ink/40">
                {t("networkMainnet")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-mono-label text-[10px] text-ink/50">
                  SUI
                </div>
                <div className="font-display text-xl tabular-nums leading-none mt-1">
                  {formatSui(balance?.totalBalance)}
                </div>
              </div>
              <div>
                <div className="font-mono-label text-[10px] text-ink/50">
                  PANS
                </div>
                <div className="font-display text-xl tabular-nums leading-none mt-1">
                  {formatTokenBalance(pansBalance?.totalBalance)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col py-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-ink hover:text-bone transition-colors"
              role="menuitem"
            >
              <span>{t("copyAddress")}</span>
              <span className="font-mono-label text-[10px] opacity-60">
                {copied ? t("copied") : "⌘C"}
              </span>
            </button>
            <a
              href={`https://suiscan.xyz/mainnet/account/${account.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-ink hover:text-bone transition-colors"
              role="menuitem"
            >
              <span>{t("viewOnSuiscan")}</span>
              <ArrowDiag size={12} />
            </a>
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className="flex items-center justify-between px-4 py-2.5 text-sm text-poppy hover:bg-poppy hover:text-bone transition-colors"
              role="menuitem"
            >
              <span>{t("disconnect")}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M5 2H2v8h3M8 4l3 2-3 2M11 6H5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

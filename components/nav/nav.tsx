import Link from "next/link";
import { PandaMark } from "@/components/brand/panda-mark";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { TreasuryPulse } from "@/components/pulse";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/create", label: "Create" },
  { href: "/docs", label: "Docs" },
];

export function Nav({
  showPulse = false,
  className,
}: {
  showPulse?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-ink/15", className)}>
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          aria-label="Pandabox home"
          className="inline-flex items-center gap-2"
        >
          <PandaMark className="h-7 w-7" />
          <span className="font-mono-label">Pandabox</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono-label px-3 py-1.5 text-ink/70 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {showPulse && (
            <div className="hidden lg:block w-[180px]">
              <TreasuryPulse variant="compact" />
            </div>
          )}
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}

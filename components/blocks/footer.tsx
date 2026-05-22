import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { Address } from "@/components/identity/address";
import { MonoLabel } from "@/components/primitives/mono-label";
import { PandaMark } from "@pandasui/ui";

const PACKAGE_ID =
  "0x3013ccea6e16aff504ec7f651ec291d048fe28c8046a75e1cd829885aae81333";
const COMMIT_HASH = process.env.NEXT_PUBLIC_COMMIT_HASH || "dev";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-ink/15", className)}>
      <div className="container grid grid-cols-1 gap-10 py-14 md:grid-cols-3">
        <div>
          <Link
            href="/"
            aria-label="Pandabox home"
            className="inline-flex items-center gap-2"
          >
            <PandaMark className="h-6 w-6" />
            <span className="font-mono-label">Pandabox</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink/60">
            The programmable funding platform for Sui. Built on-chain, open by
            default.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10">
          <Column heading="Navigate">
            <FooterLink href="/explore">Explore</FooterLink>
            <FooterLink href="/create">Create</FooterLink>
            <FooterLink href="/dashboard">Dashboard</FooterLink>
            <FooterLink href="/docs">Docs</FooterLink>
          </Column>
          <Column heading="Ecosystem">
            <FooterLink href="https://suiscan.xyz" external>
              Sui Explorer
            </FooterLink>
            <FooterLink href="https://sui.io" external>
              Sui Network
            </FooterLink>
            <FooterLink href="https://x.com/0xPandaSui" external>
              Twitter
            </FooterLink>
          </Column>
        </div>

        <Column heading="Technical">
          <div className="space-y-2 text-sm">
            <Row label="Move package">
              <Address value={PACKAGE_ID} link />
            </Row>
            <Row label="Network">
              <span className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_SUI_NETWORK || "mainnet"}
              </span>
            </Row>
            <Row label="Commit">
              <span className="font-mono text-xs"></span>
            </Row>
          </div>
        </Column>
      </div>

      <div className="border-t border-ink/15">
        <div className="container flex items-center justify-between py-4 text-xs text-ink/50">
          <span className="font-mono-label">© Pandabox</span>
          <span className="font-mono-label">v2 · Mainnet build</span>
        </div>
      </div>
    </footer>
  );
}

function Column({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel className="block">{heading}</MonoLabel>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const Tag = external ? "a" : Link;
  const props = external
    ? { href, target: "_blank", rel: "noreferrer" }
    : { href };
  return (
    <li>
      <Tag
        {...(props as { href: string })}
        className="text-sm text-ink/70 transition-colors hover:text-ink"
      >
        {children}
      </Tag>
    </li>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono-label text-[10px] text-ink/50">{label}</span>
      {children}
    </div>
  );
}

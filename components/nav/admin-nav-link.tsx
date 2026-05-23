"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "@/lib/contracts/pandabox";
import { cn } from "@pandasui/ui/lib";

/**
 * Conditional "Admin" link — renders only when the connected wallet holds
 * the on-chain `PlatformAdminCap`. Hidden completely for everyone else so
 * the operator surface doesn't leak into discovery.
 *
 * The check is a single owned-objects query against the platform module,
 * lazy-fired on mount + wallet change. If you ever transfer the cap, the
 * link will hide on next page nav.
 */
export function AdminNavLink() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!account) {
      setShow(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const res = await client.getOwnedObjects({
          owner: account.address,
          filter: {
            MoveModule: { package: PACKAGE_ID, module: "platform" },
          },
          options: { showType: true },
          limit: 50,
        });
        if (ac.signal.aborted) return;
        const has = res.data.some(
          (o) =>
            (o.data?.type ?? "") ===
            `${PACKAGE_ID}::platform::PlatformAdminCap`,
        );
        setShow(has);
      } catch {
        // Fail silent — the link just stays hidden.
      }
    })();
    return () => ac.abort();
  }, [account, client]);

  const pathname = usePathname() ?? "";
  const active = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!show) return null;

  return (
    <Link
      href="/admin"
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative font-mono-label px-3 py-1.5 transition-colors",
        active ? "text-ink" : "text-sky hover:text-ink",
      )}
    >
      Admin
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-center bg-sky transition-transform duration-300 ease-out",
          active ? "scale-x-100" : "scale-x-0",
        )}
      />
    </Link>
  );
}

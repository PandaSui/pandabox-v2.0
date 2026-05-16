"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TxHash } from "@/components/identity/tx-hash";
import type { ActivityListDTO, PaymentDTO } from "@/lib/api/project-dto";

export function ActivityTable({
  projectId,
  initial,
  pageSize = 25,
  showProjectColumn = false,
  className,
}: {
  projectId: string;
  initial: ActivityListDTO;
  pageSize?: number;
  showProjectColumn?: boolean;
  className?: string;
}) {
  const [items, setItems] = useState<PaymentDTO[]>(initial.items);
  const [cursor, setCursor] = useState<string | undefined>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Reset when projectId changes.
  useEffect(() => {
    setItems(initial.items);
    setCursor(initial.nextCursor);
  }, [initial]);

  const onLoadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const myId = ++reqId.current;
    try {
      const p = new URLSearchParams();
      p.set("limit", String(pageSize));
      p.set("cursor", cursor);
      const res = await fetch(
        `/api/projects/${projectId}/activity?${p.toString()}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as ActivityListDTO;
      if (myId !== reqId.current) return;
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink/50">
        No activity yet.
      </p>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        role="table"
        className="w-full text-xs"
      >
        <div
          role="row"
          className={cn(
            "grid items-center gap-3 border-b border-ink/15 py-2",
            showProjectColumn
              ? "grid-cols-[7rem_1fr_1fr_7rem_1fr]"
              : "grid-cols-[7rem_1fr_7rem_1fr_7rem]",
          )}
        >
          <span role="columnheader" className="font-mono-label text-ink/60">Time</span>
          {showProjectColumn && (
            <span role="columnheader" className="font-mono-label text-ink/60">Project</span>
          )}
          <span role="columnheader" className="font-mono-label text-ink/60">Payer</span>
          <span role="columnheader" className="font-mono-label text-ink/60">Amount</span>
          <span role="columnheader" className="font-mono-label text-ink/60">Memo</span>
          {!showProjectColumn && (
            <span role="columnheader" className="font-mono-label text-ink/60">Tx</span>
          )}
        </div>

        {items.map((p) => (
          <div
            key={p.txHash}
            role="row"
            className={cn(
              "grid items-center gap-3 border-b border-ink/10 py-2",
              showProjectColumn
                ? "grid-cols-[7rem_1fr_1fr_7rem_1fr]"
                : "grid-cols-[7rem_1fr_7rem_1fr_7rem]",
            )}
          >
            <span role="cell">
              <RelativeTime value={p.timestamp} className="text-xs text-ink/70" />
            </span>
            {showProjectColumn && (
              <span role="cell" className="truncate">
                <span style={{ color: accentHex(p.projectAccent) }}>● </span>
                <span className="text-ink/80">{p.projectName}</span>
              </span>
            )}
            <span role="cell">
              <Address value={p.payer} copyable={false} />
            </span>
            <span role="cell">
              <SuiAmount
                mist={BigInt(p.amountMist)}
                maxFractionDigits={2}
                className="text-xs"
              />
            </span>
            <span role="cell" className="truncate text-ink/55">
              {p.memo || <span className="text-ink/25">—</span>}
            </span>
            {!showProjectColumn && (
              <span role="cell">
                <TxHash value={p.txHash} head={4} tail={4} copyable={false} />
              </span>
            )}
          </div>
        ))}
      </div>

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className={cn(
              "diecut border border-ink/40 px-5 py-2 transition-colors",
              "hover:border-ink hover:bg-ink hover:text-bone",
              loading && "opacity-60",
            )}
          >
            <span className="font-mono-label">
              {loading ? "Loading…" : "Load more"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function accentHex(a: PaymentDTO["projectAccent"]): string {
  const map: Record<PaymentDTO["projectAccent"], string> = {
    saffron: "#B8C45E",
    poppy: "#C47557",
    jade: "#6E8E5D",
    sky: "#6D8796",
    sun: "#D9C57A",
    plum: "#7E685E",
  };
  return map[a];
}

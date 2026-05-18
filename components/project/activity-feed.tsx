import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { explorerUrl } from "@/lib/sui";
import type { ActivityItem } from "@/lib/activity";

/**
 * Read-only feed of recent on-chain events for a project. Renders a dense
 * mono-numeric table — time · kind · actor · figures · tx — modelled after
 * the activity strip on the landing's Treasury Pulse section.
 */
export function ActivityFeed({
  items,
  ticker,
}: {
  items: ActivityItem[];
  ticker: string;
}) {
  if (items.length === 0) {
    return (
      <div className="border border-ink/15 bg-bone p-6 shadow-offset-sm">
        <MonoLabel>Activity</MonoLabel>
        <p className="mt-2 text-sm text-ink/55">
          No on-chain activity for this project yet. Contributions, claims,
          and withdrawals will surface here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-ink/15 bg-bone shadow-offset-sm">
      <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
        <MonoLabel className="text-[10px]">Activity</MonoLabel>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
          {items.length} event{items.length === 1 ? "" : "s"} · revalidates 30s
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b border-ink/10 text-left font-mono-label text-[10px] text-ink/55">
              <th className="px-5 py-2 font-normal">Time</th>
              <th className="px-3 py-2 font-normal">Event</th>
              <th className="px-3 py-2 font-normal">Actor</th>
              <th className="px-3 py-2 text-right font-normal">SUI</th>
              <th className="px-3 py-2 text-right font-normal">{ticker}</th>
              <th className="px-5 py-2 text-right font-normal">Tx</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.digest + it.kind + it.timestampMs}
                className="border-b border-ink/[0.07] last:border-b-0"
              >
                <td className="whitespace-nowrap px-5 py-2 tabular-nums text-ink/65">
                  {formatRelative(it.timestampMs)}
                </td>
                <td className="px-3 py-2">
                  <KindBadge kind={it.kind} extra={it.extra} />
                </td>
                <td className="px-3 py-2">
                  {it.actor ? (
                    <Address value={it.actor} link className="text-[11px]" />
                  ) : (
                    <span className="text-ink/35">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink/80">
                  {it.suiAmount > 0n ? formatSui(it.suiAmount) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink/80">
                  {it.tokenAmount > 0n ? formatToken(it.tokenAmount) : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-2 text-right">
                  <a
                    href={explorerUrl("tx", it.digest)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink/55 hover:text-ink"
                  >
                    {it.digest.slice(0, 8)}…
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KindBadge({
  kind,
  extra,
}: {
  kind: ActivityItem["kind"];
  extra?: string;
}) {
  const map: Record<
    ActivityItem["kind"],
    { label: string; color: string; dot: string }
  > = {
    contribute: {
      label: "Contributed",
      color: "text-jade",
      dot: "bg-jade",
    },
    claim: {
      label: "Claimed",
      color: "text-saffron",
      dot: "bg-saffron",
    },
    withdraw: {
      label: "Withdrawn",
      color: "text-poppy",
      dot: "bg-poppy",
    },
    close: {
      label: "Closed",
      color: "text-sky",
      dot: "bg-sky",
    },
  };
  const m = map[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5", m.color)}>
      <span aria-hidden className={cn("block h-1.5 w-1.5 rounded-full", m.dot)} />
      <span className="font-mono-label text-[10px] uppercase tracking-[0.14em]">
        {m.label}
        {extra && (
          <span className="ml-1 text-ink/45">· {extra}</span>
        )}
      </span>
    </span>
  );
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function formatSui(mist: bigint): string {
  return formatToken(mist);
}

function formatToken(raw: bigint, decimals = 9): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}

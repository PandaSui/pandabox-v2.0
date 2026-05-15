export function formatCompact(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatCompactWhole(n: number) {
  if (n >= 1_000_000_000) return Math.round(n / 1_000_000_000) + "B";
  if (n >= 1_000_000) return Math.round(n / 1_000_000) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return Math.round(n).toString();
}

export function formatUSD(n: number) {
  return "$" + formatCompact(n);
}

export function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPrice(n: number): string {
  if (!n) return "—";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  if (n >= 0.00000001) return `$${n.toFixed(8)}`;
  return `$${n.toExponential(2)}`;
}

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

"use client";

import { cn } from "@pandasui/ui/lib";
import { ACCENT } from "@/lib/admin/accent";
import type { ProtocolAccent } from "@/lib/admin/protocols";

/**
 * Shared chrome for operator-console action panels — one button style, one
 * success block, one error banner, one modal footer. Every protocol panel
 * (Pandabox / Redeem / Airdrop) composes these so the console feels like a
 * single instrument rather than three bolted-together tools.
 */

export const ADMIN_CTA =
  "group relative inline-flex items-center justify-center gap-2 h-10 px-4 font-medium uppercase tracking-[0.12em] text-[0.72rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

export function Success({
  digest,
  label,
  body,
}: {
  digest: string;
  label: string;
  body: string;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
        <span className="font-mono-label text-[11px]">{label}</span>
        <p className="mt-1 text-ink/75">{body}</p>
      </div>
      <p className="break-all font-mono text-[11px] text-ink/55">
        digest · {digest}
      </p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
    >
      {message}
    </p>
  );
}

export function ModalFooter({
  busy,
  primary,
  onCancel,
  onConfirm,
  danger = false,
  disabled = false,
  accent = "saffron",
}: {
  busy: boolean;
  primary: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Confirm-button fill for non-danger actions; matches the active panel. */
  accent?: ProtocolAccent;
}) {
  const a = ACCENT[accent];
  return (
    <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={cn(ADMIN_CTA, "bg-bone text-ink")}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          ADMIN_CTA,
          danger
            ? "bg-poppy text-bone border-poppy"
            : cn(a.solid, a.onAccentText),
        )}
      >
        {primary}
      </button>
    </div>
  );
}

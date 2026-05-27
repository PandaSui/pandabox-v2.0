"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import {
  parseRecipients,
  liveRows,
  blockingRows,
  type DuplicatePolicy,
  type RecipientRow,
  type RecipientRowIssue,
} from "@/lib/airdrop";

/**
 * The composer's centerpiece. Two stacked panels separated by a kinetic
 * hairline divider:
 *
 *   - **INPUT** (top)   — textarea with line-number gutter, drag-and-drop
 *                         overlay for CSV / JSON file imports, and a
 *                         small toolbar (clear, sample, dedupe policy).
 *   - **PARSED** (bottom) — live row table, mono, with per-row status
 *                         dots (jade live, poppy error, sky merged).
 *                         Updates on every keystroke via the pure
 *                         `parseRecipients` helper from Phase 2.
 *
 * No diecut shapes anywhere — corner ticks + hairlines + offset shadows
 * carry the structure. Drag-and-drop reads from the entire panel area
 * so dropping a file from Finder anywhere on the surface triggers the
 * import.
 */
export function RecipientList({
  rawInput,
  onRawInputChange,
  duplicatePolicy,
  onDuplicatePolicyChange,
  decimals,
  symbol,
  coinPicked,
}: {
  rawInput: string;
  onRawInputChange: (v: string) => void;
  duplicatePolicy: DuplicatePolicy;
  onDuplicatePolicyChange: (p: DuplicatePolicy) => void;
  decimals: number;
  symbol: string | null;
  coinPicked: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);

  // Re-parse on every keystroke. The parser is pure + cheap (no chain),
  // so memoization on `(rawInput, decimals, duplicatePolicy)` is enough.
  const parsed = useMemo(
    () => parseRecipients(rawInput, { decimals, duplicatePolicy }),
    [rawInput, decimals, duplicatePolicy],
  );

  const live = useMemo(() => liveRows(parsed.rows), [parsed.rows]);
  const blocking = useMemo(() => blockingRows(parsed.rows), [parsed.rows]);
  const totalAmountRaw = useMemo(
    () => live.reduce<bigint>((acc, r) => acc + r.amountRaw, 0n),
    [live],
  );

  const onFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      onRawInputChange(text);
    },
    [onRawInputChange],
  );

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) await onFile(f);
      // Reset so the same file can be re-imported after a clear.
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onFile],
  );

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDraggingFile(true);
  }, []);
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // The dragleave event fires for every nested child. We only end the
    // dragging state when the cursor truly exits the panel, signaled by
    // a `relatedTarget` outside the panel.
    if (
      !e.currentTarget.contains(e.relatedTarget as Node | null) &&
      e.relatedTarget !== e.currentTarget
    ) {
      setDraggingFile(false);
    }
  }, []);
  const onDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggingFile(false);
      const file = e.dataTransfer.files?.[0];
      if (file) await onFile(file);
    },
    [onFile],
  );

  const insertSample = useCallback(() => {
    onRawInputChange(SAMPLE_CSV);
  }, [onRawInputChange]);

  const clearAll = useCallback(() => {
    onRawInputChange("");
  }, [onRawInputChange]);

  return (
    <div
      className="relative border border-ink/15 bg-bone"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay — full panel poppy translucent surface with a giant
          glyph + instruction copy. Becomes the page's brief identity
          moment while the user is actively dropping a file. */}
      {draggingFile ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-poppy/15 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] text-ink">
            <DropGlyph />
            <span>Drop CSV or JSON to import</span>
          </div>
        </div>
      ) : null}

      {/* ── Input pane ─────────────────────────────────────────────── */}
      <div className="border-b border-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-ink/[0.015] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Input
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-ink/55">
              {countLines(rawInput)} line{countLines(rawInput) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DedupeSwitch
              value={duplicatePolicy}
              onChange={onDuplicatePolicyChange}
            />
            <ToolbarButton onClick={insertSample} accent="poppy">
              Sample
            </ToolbarButton>
            <ToolbarButton onClick={onPickFile}>Import file</ToolbarButton>
            <ToolbarButton onClick={clearAll} disabled={!rawInput}>
              Clear
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json,.tsv"
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>
        </div>

        <GutterTextarea
          value={rawInput}
          onChange={onRawInputChange}
          placeholder={
            coinPicked
              ? "0xabc…1234,1.5\n0xdef…5678,12\n# or paste JSON: [{address, amount}, …]"
              : "Pick an asset above first — then paste your recipient list here."
          }
          disabled={!coinPicked}
        />
      </div>

      {/* ── Parsed pane ────────────────────────────────────────────── */}
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-ink/[0.015] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Parsed
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-ink/55">
              {live.length} live
              {blocking.length > 0
                ? ` · ${blocking.length} blocking`
                : ""}
              {parsed.skippedLineCount > 0
                ? ` · ${parsed.skippedLineCount} skipped`
                : ""}
            </span>
          </div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
            Total{" "}
            <span className="tabular-nums text-ink">
              {formatAmount(totalAmountRaw, {
                decimals,
                maxFractionDigits: 4,
              })}
            </span>{" "}
            <span className="text-ink/55">{symbol ?? ""}</span>
          </div>
        </div>

        {parsed.errors.length > 0 ? (
          <ErrorBanner messages={parsed.errors} />
        ) : null}

        {parsed.rows.length === 0 ? (
          <EmptyState coinPicked={coinPicked} />
        ) : (
          <RowTable rows={parsed.rows} decimals={decimals} symbol={symbol} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── gutter textarea ─────────────────────────── */

function GutterTextarea({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lineCount = countLines(value);
  const lineNumbers = useMemo(
    () => Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1),
    [lineCount],
  );

  // Keep the gutter scrolled in sync with the textarea.
  useEffect(() => {
    const ta = taRef.current;
    const gutter = gutterRef.current;
    if (!ta || !gutter) return;
    const onScroll = () => {
      gutter.scrollTop = ta.scrollTop;
    };
    ta.addEventListener("scroll", onScroll);
    return () => ta.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative flex">
      <div
        ref={gutterRef}
        aria-hidden
        className="pointer-events-none max-h-[280px] min-h-[180px] w-10 shrink-0 overflow-hidden border-r border-ink/10 bg-ink/[0.02] py-3 font-mono text-[11px] leading-[1.6] tabular-nums text-ink/35"
      >
        {lineNumbers.map((n) => (
          <div key={n} className="px-2 text-right">
            {n}
          </div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "min-h-[180px] w-full resize-y border-0 bg-bone px-3 py-3 font-mono text-[12px] leading-[1.6]",
          "text-ink placeholder:text-ink/35",
          "focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-ink/[0.02] disabled:opacity-70",
        )}
        style={{ maxHeight: "280px" }}
      />
    </div>
  );
}

/* ─────────────────────────── row table ─────────────────────────── */

function RowTable({
  rows,
  decimals,
  symbol,
}: {
  rows: RecipientRow[];
  decimals: number;
  symbol: string | null;
}) {
  return (
    <div className="max-h-[360px] overflow-y-auto">
      <table className="w-full table-fixed border-collapse font-mono text-[12px] tabular-nums">
        <thead className="sticky top-0 z-[1] bg-bone">
          <tr className="border-b border-ink/15">
            <th className="w-10 px-3 py-2 text-left text-[10px] uppercase tracking-[0.16em] text-ink/45">
              #
            </th>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.16em] text-ink/45">
              Address
            </th>
            <th className="w-44 px-3 py-2 text-right text-[10px] uppercase tracking-[0.16em] text-ink/45">
              Amount
            </th>
            <th className="w-44 px-3 py-2 text-left text-[10px] uppercase tracking-[0.16em] text-ink/45">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Row
              key={row.id}
              index={i + 1}
              row={row}
              decimals={decimals}
              symbol={symbol}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  index,
  row,
  decimals,
  symbol,
}: {
  index: number;
  row: RecipientRow;
  decimals: number;
  symbol: string | null;
}) {
  const status = rowStatus(row);
  const amountFormatted = formatAmount(row.amountRaw, {
    decimals,
    maxFractionDigits: 6,
  });
  return (
    <tr
      className={cn(
        "border-b border-ink/[0.06] transition-colors",
        status.kind === "blocking"
          ? "bg-poppy/[0.06]"
          : status.kind === "merged"
            ? "bg-sky/[0.05]"
            : "hover:bg-ink/[0.025]",
      )}
    >
      <td className="px-3 py-2 text-ink/45">
        {index.toString().padStart(2, "0")}
      </td>
      <td className="px-3 py-2 text-ink">
        {row.issues.some((i) => i.kind === "invalid-address") ? (
          <span className="text-poppy">{row.amountInput || row.address}</span>
        ) : (
          truncMiddle(row.address, 8)
        )}
      </td>
      <td className="px-3 py-2 text-right text-ink">
        {row.amountRaw > 0n ? (
          <>
            {amountFormatted}
            <span className="ml-1 text-ink/45">{symbol ?? ""}</span>
          </>
        ) : (
          <span className="text-ink/35">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <StatusChip status={status} />
      </td>
    </tr>
  );
}

type RowStatus =
  | { kind: "live" }
  | { kind: "merged"; into: string }
  | { kind: "blocking"; issue: RecipientRowIssue };

function rowStatus(row: RecipientRow): RowStatus {
  const fatal = row.issues.find(
    (i) =>
      i.kind === "invalid-address" ||
      i.kind === "invalid-amount" ||
      i.kind === "zero-amount",
  );
  if (fatal) return { kind: "blocking", issue: fatal };
  const merged = row.issues.find((i) => i.kind === "duplicate");
  if (merged) {
    return {
      kind: "merged",
      into: merged.kind === "duplicate" ? merged.mergedWith : "",
    };
  }
  return { kind: "live" };
}

function StatusChip({ status }: { status: RowStatus }) {
  if (status.kind === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-jade">
        <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
        ready
      </span>
    );
  }
  if (status.kind === "merged") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sky">
        <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-sky" />
        merged
      </span>
    );
  }
  // blocking — render the specific issue label.
  return (
    <span className="inline-flex items-center gap-1.5 text-poppy">
      <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
      {labelForIssue(status.issue)}
    </span>
  );
}

function labelForIssue(issue: RecipientRowIssue): string {
  switch (issue.kind) {
    case "invalid-address":
      return "bad address";
    case "invalid-amount":
      return "bad amount";
    case "zero-amount":
      return "zero";
    case "duplicate":
      return "duplicate";
  }
}

/* ─────────────────────────── empty / error states ─────────────────────────── */

function EmptyState({ coinPicked }: { coinPicked: boolean }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-sans text-[13.5px] text-ink/60">
        {coinPicked
          ? "Paste a recipient list above to see it parsed here."
          : "Pick an asset above to begin composing."}
      </p>
    </div>
  );
}

function ErrorBanner({ messages }: { messages: string[] }) {
  return (
    <div className="border-b border-poppy/40 bg-poppy/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-poppy">
      {messages.join(" · ")}
    </div>
  );
}

/* ─────────────────────────── toolbar primitives ─────────────────────────── */

function ToolbarButton({
  onClick,
  disabled,
  accent,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  accent?: "poppy";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center border bg-bone px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
        accent === "poppy"
          ? "border-poppy/55 text-poppy hover:bg-poppy/10"
          : "border-ink/20 text-ink/75 hover:border-ink/55 hover:text-ink",
        disabled && "cursor-not-allowed opacity-50 hover:border-ink/20 hover:text-ink/75",
      )}
    >
      {children}
    </button>
  );
}

function DedupeSwitch({
  value,
  onChange,
}: {
  value: DuplicatePolicy;
  onChange: (p: DuplicatePolicy) => void;
}) {
  const options: { id: DuplicatePolicy; label: string; title: string }[] = [
    { id: "sum", label: "Sum", title: "Merge duplicates by summing their amounts" },
    { id: "first", label: "First", title: "Keep the first occurrence, drop the rest" },
    { id: "reject", label: "Reject", title: "Flag duplicates as errors" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Duplicate policy"
      className="inline-flex border border-ink/20 bg-bone"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.id)}
            type="button"
            className={cn(
              "relative px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
              active
                ? "bg-ink text-bone"
                : "text-ink/65 hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── misc helpers ─────────────────────────── */

function DropGlyph() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <rect x="6" y="6" width="32" height="32" />
      <path d="M22 14 L22 28 M16 22 L22 28 L28 22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function countLines(s: string): number {
  if (!s) return 0;
  return s.split(/\r?\n/).length;
}

function truncMiddle(s: string, keep: number): string {
  if (s.length <= keep * 2 + 1) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

const SAMPLE_CSV = [
  "# Paste your own list, or use this sample to see the parser at work.",
  "0x1111111111111111111111111111111111111111111111111111111111111111,1.5",
  "0x2222222222222222222222222222222222222222222222222222222222222222,2",
  "0x3333333333333333333333333333333333333333333333333333333333333333,0.25",
  "0x4444444444444444444444444444444444444444444444444444444444444444,12.4",
].join("\n");

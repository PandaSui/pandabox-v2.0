"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Chevron } from "@/components/ui/icon";

export type Column<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  mono?: boolean;
  sortable?: boolean;
  sortKey?: (row: Row) => number | string;
  className?: string;
  hideOnMobile?: boolean;
};

type DataTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  caption?: string;
  emptyTitle?: string;
  emptyHint?: string;
  loading?: boolean;
  rowKey: (row: Row, index: number) => string;
  onRowClick?: (row: Row) => void;
  defaultSort?: { id: string; direction: "asc" | "desc" };
  className?: string;
};

export function DataTable<Row>({
  columns,
  rows,
  caption,
  emptyTitle = "Nothing here yet",
  emptyHint,
  loading,
  rowKey,
  onRowClick,
  defaultSort,
  className,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState(defaultSort);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col || !col.sortable) return rows;
    const key = col.sortKey;
    if (!key) return rows;
    return [...rows].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sort.direction === "asc" ? av - bv : bv - av;
      }
      return sort.direction === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, sort, columns]);

  const toggleSort = (id: string) => {
    setSort((cur) => {
      if (cur?.id === id) {
        return cur.direction === "desc"
          ? { id, direction: "asc" }
          : undefined;
      }
      return { id, direction: "desc" };
    });
  };

  return (
    <div className={cn("relative border border-ink bg-bone", className)}>
      {caption ? (
        <div className="flex items-center gap-4 px-5 h-12 border-b border-ink/15">
          <span className="font-mono-label text-ink/60">{caption}</span>
          <span className="h-px flex-1 bg-ink/10" />
          <span className="font-mono-label text-ink/40">{sortedRows.length} row{sortedRows.length === 1 ? "" : "s"}</span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-paper/60 border-b border-ink/15">
              {columns.map((c) => {
                const active = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={{ width: c.width }}
                    className={cn(
                      "text-left font-mono-label text-ink/55 h-11 px-4 whitespace-nowrap",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.hideOnMobile && "hidden md:table-cell",
                      c.sortable && "cursor-pointer select-none hover:text-ink"
                    )}
                    onClick={() => c.sortable && toggleSort(c.id)}
                  >
                    <span className={cn("inline-flex items-center gap-1.5", c.align === "right" && "justify-end w-full")}>
                      {c.header}
                      {c.sortable ? (
                        <Chevron
                          size={10}
                          className={cn(
                            "transition-transform text-ink/30",
                            active && "text-ink",
                            active && sort?.direction === "asc" && "rotate-180"
                          )}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows columns={columns} />
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-10 text-center">
                  <div className="font-display text-xl mb-1">{emptyTitle}</div>
                  {emptyHint ? <div className="text-sm text-ink/55">{emptyHint}</div> : null}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-ink/10 last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-paper/60"
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-4 py-3.5 align-middle text-sm text-ink/85",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.mono && "font-mono tabular-nums",
                        c.hideOnMobile && "hidden md:table-cell",
                        c.className
                      )}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkeletonRows<Row>({ columns }: { columns: Column<Row>[] }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-ink/10 last:border-0">
          {columns.map((c) => (
            <td key={c.id} className={cn("px-4 py-4", c.hideOnMobile && "hidden md:table-cell")}>
              <div className="h-3 bg-ink/10 animate-pulse" style={{ width: `${40 + ((i * 13 + c.id.length * 7) % 50)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

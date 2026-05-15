"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-ink/45"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[71] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal
            className={cn(
              "pointer-events-auto relative w-full max-w-lg bg-bone border border-ink shadow-offset-lg flex flex-col",
              className
            )}
          >
            {title ? (
              <div className="flex items-center justify-between border-b border-ink/15 px-6 h-14 shrink-0">
                <span className="font-mono-label text-ink/70">{title}</span>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 inline-flex items-center justify-center border border-ink/20 hover:border-ink"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                </button>
              </div>
            ) : null}
            <div className="p-6">{children}</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

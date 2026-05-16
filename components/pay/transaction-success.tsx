import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { Diecut } from "@/components/primitives/diecut";
import { Frame } from "@/components/primitives/frame";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { TxHash } from "@/components/identity/tx-hash";

export function TransactionSuccess({
  title,
  projectName,
  txDigest,
  primaryHref,
  primaryLabel,
  className,
}: {
  title: string;
  projectName?: string;
  txDigest: string;
  primaryHref?: string;
  primaryLabel?: string;
  className?: string;
}) {
  return (
    <Frame className={cn("space-y-4", className)}>
      <MonoLabel accent="jade">{title}</MonoLabel>
      {projectName && (
        <p className="text-2xl">
          <Marker color="saffron">{projectName}</Marker>
        </p>
      )}
      <div className="space-y-1">
        <span className="font-mono-label text-[10px] text-ink/50 block">
          Transaction
        </span>
        <TxHash value={txDigest} head={6} tail={4} />
      </div>
      {primaryHref && primaryLabel && (
        <div className="pt-2">
          <Link
            href={primaryHref}
            className="diecut inline-flex bg-ink px-5 py-2.5 text-bone hover:bg-ink-90 transition-colors"
          >
            <span className="font-mono-label">{primaryLabel}</span>
          </Link>
        </div>
      )}
    </Frame>
  );
}

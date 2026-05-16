import { cn } from "@pandasui/ui/lib";
import { Frame } from "@/components/primitives/frame";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { Identicon } from "@/components/identity/identicon";

export function AdminCapCard({
  capId,
  holder,
  className,
}: {
  capId: string;
  holder: string;
  className?: string;
}) {
  return (
    <Frame className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <MonoLabel>Project admin cap</MonoLabel>
        <span className="font-mono-label text-[10px] text-ink/40">SUI OBJECT</span>
      </div>

      <div className="flex items-center gap-3">
        <Identicon value={capId} size={44} />
        <div className="min-w-0">
          <div className="text-sm">
            <Address value={capId} link className="text-ink" />
          </div>
          <div className="mt-1 text-xs text-ink/55">
            held by <Address value={holder} link />
          </div>
        </div>
      </div>

      <p className="text-xs text-ink/55">
        Holding this object grants admin rights — queue reconfigurations,
        distribute payouts, transfer to a multisig.
      </p>
    </Frame>
  );
}

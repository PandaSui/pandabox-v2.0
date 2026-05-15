import Image from "next/image";
import { cn } from "@/lib/cn";

export function PandaMark({ className }: { className?: string }) {
  return (
    <Image
      src="/panda-logo.png"
      alt="Pandasui logo"
      width={512}
      height={512}
      sizes="(max-width: 768px) 160px, 240px"
      className={cn("block h-auto w-full object-contain", className)}
      priority
    />
  );
}

import { cn } from "@pandasui/ui/lib";

export function Frame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("frame p-6", className)}>{children}</div>;
}

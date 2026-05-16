import { cn } from "@/lib/cn";

export function Diecut({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return <Tag className={cn("diecut", className)}>{children}</Tag>;
}

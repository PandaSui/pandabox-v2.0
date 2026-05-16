import { cn } from "@pandasui/ui/lib";

export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return <Tag className={cn("container", className)}>{children}</Tag>;
}

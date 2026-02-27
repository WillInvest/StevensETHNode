import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "bg-bg-card border border-border-subtle rounded-md p-5 transition-colors hover:border-border-default hover:bg-bg-card-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("text-[15px] font-semibold mb-3", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("text-[13px]", className)} {...props} />;
}

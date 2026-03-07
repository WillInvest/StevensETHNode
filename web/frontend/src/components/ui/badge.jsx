import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        running: "bg-accent-glow text-text-accent",
        completed: "bg-[rgba(34,197,94,0.12)] text-green",
        failed: "bg-[rgba(239,68,68,0.12)] text-red",
        paused: "bg-[rgba(245,158,11,0.12)] text-amber",
        pending: "bg-[rgba(255,255,255,0.06)] text-text-muted",
      },
    },
    defaultVariants: {
      variant: "pending",
    },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

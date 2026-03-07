import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-hover hover:shadow-lg rounded-sm px-4 py-2",
        ghost: "bg-transparent text-text-secondary border border-border-default hover:text-text-primary hover:border-text-secondary rounded-sm px-4 py-2",
        destructive: "bg-red text-white hover:opacity-90 rounded-sm px-4 py-2",
      },
      size: {
        sm: "text-[11px] px-2 py-1",
        md: "text-[13px] px-4 py-2",
        lg: "text-[15px] px-6 py-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

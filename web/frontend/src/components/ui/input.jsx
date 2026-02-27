import { cn } from "../../lib/utils";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 text-[13px] font-mono",
        "bg-bg-input text-text-primary",
        "border border-border-default rounded-sm",
        "focus:outline-none focus:border-accent",
        "placeholder:text-text-muted",
        "transition-colors",
        className
      )}
      {...props}
    />
  );
}

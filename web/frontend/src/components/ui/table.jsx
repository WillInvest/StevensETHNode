import { cn } from "../../lib/utils";

export function Table({ className, ...props }) {
  return <table className={cn("data-table", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return <thead className={cn("", className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("", className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("", className)} {...props} />;
}

export function TableHeader({ className, ...props }) {
  return <th className={cn("", className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn("", className)} {...props} />;
}

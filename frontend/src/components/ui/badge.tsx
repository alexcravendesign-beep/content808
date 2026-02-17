import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const variants: Record<string, string> = {
  default: "bg-zinc-100 text-zinc-900",
  secondary: "bg-zinc-800 text-zinc-100",
  destructive: "bg-red-600 text-white",
  outline: "border border-zinc-600 text-zinc-300",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

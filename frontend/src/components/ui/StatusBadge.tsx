import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
    idea: { bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "bg-indigo-400", glow: "shadow-indigo-500/20" },
    draft: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400", glow: "shadow-violet-500/20" },
    review: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", glow: "shadow-amber-500/20" },
    approved: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", glow: "shadow-emerald-500/20" },
    blocked: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", glow: "shadow-red-500/20" },
    scheduled: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400", glow: "shadow-blue-500/20" },
    published: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400", glow: "shadow-cyan-500/20" },
};

interface StatusBadgeProps {
    status: string;
    showLabel?: boolean;
    size?: "sm" | "md";
    className?: string;
}

export function StatusBadge({ status, showLabel = true, size = "sm", className }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] || { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500", glow: "" };
    const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
    const textSize = size === "sm" ? "text-[10px]" : "text-xs";
    const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-medium capitalize",
                config.bg, config.text, padding, textSize,
                className
            )}
        >
            <span className={cn("rounded-full shrink-0", config.dot, dotSize)} />
            {showLabel && status}
        </span>
    );
}

export { STATUS_CONFIG };

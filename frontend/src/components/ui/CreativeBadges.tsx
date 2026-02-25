import { cn } from "@/lib/utils";
import { ContentItem } from "@/api/client";
import { Sparkles, Image, ThumbsUp, CheckCircle2 } from "lucide-react";

interface CreativeBadgesProps {
    item: ContentItem;
    /** "compact" for month grid cells, "inline" for week/day/agenda rows, "detail" for popovers */
    variant?: "compact" | "inline" | "detail";
    className?: string;
}

/**
 * Modernised creative-status badges for Hero / Infographic / Facebook approval.
 *
 * - **compact** – tiny pill badges (H / I / FB) for month-grid cells where space is tight
 * - **inline** – small icon+label pills for week, day, and agenda rows
 * - **detail** – slightly larger pills with counts, for the event popover
 */
export function CreativeBadges({ item, variant = "inline", className }: CreativeBadgesProps) {
    const heroReady = !!item.has_hero;
    const infraReady = !!item.has_infographic;
    const fbApproved = !!item.has_facebook_approved;
    const allDone = !!item.creative_done;

    // Nothing to show if all flags are missing / false
    if (!heroReady && !infraReady && !fbApproved) return null;

    if (variant === "compact") {
        return (
            <span className={cn("inline-flex items-center gap-0.5 shrink-0", className)}>
                {heroReady && (
                    <span className="inline-flex items-center justify-center h-[14px] px-1 rounded bg-fuchsia-500/20 text-fuchsia-400 text-[8px] font-bold leading-none" title="Hero image ready">
                        H
                    </span>
                )}
                {infraReady && (
                    <span className="inline-flex items-center justify-center h-[14px] px-1 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold leading-none" title="Infographic ready">
                        I
                    </span>
                )}
                {fbApproved && (
                    <span className="inline-flex items-center justify-center h-[14px] px-1 rounded bg-blue-500/20 text-blue-400 text-[8px] font-bold leading-none" title={`Facebook approved${item.approved_facebook_posts ? ` (${item.approved_facebook_posts})` : ""}`}>
                        FB
                    </span>
                )}
            </span>
        );
    }

    if (variant === "inline") {
        return (
            <span className={cn("inline-flex items-center gap-1 shrink-0", className)}>
                {heroReady && (
                    <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-fuchsia-500/15 text-fuchsia-400 text-[9px] font-semibold leading-none" title="Hero image ready">
                        <Sparkles className="h-2.5 w-2.5" />
                        H
                    </span>
                )}
                {infraReady && (
                    <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold leading-none" title="Infographic ready">
                        <Image className="h-2.5 w-2.5" />
                        I
                    </span>
                )}
                {fbApproved && (
                    <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-semibold leading-none" title={`Facebook approved${item.approved_facebook_posts ? ` (${item.approved_facebook_posts})` : ""}`}>
                        <ThumbsUp className="h-2.5 w-2.5" />
                        FB
                    </span>
                )}
                {allDone && (
                    <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-cyan-500/15 text-cyan-400 text-[9px] font-semibold leading-none" title="All creative assets done">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                    </span>
                )}
            </span>
        );
    }

    // variant === "detail"
    return (
        <span className={cn("inline-flex items-center gap-1.5 shrink-0 flex-wrap", className)}>
            <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold",
                heroReady ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-zinc-700/40 text-zinc-500"
            )} title={heroReady ? "Hero image ready" : "Hero missing"}>
                <Sparkles className="h-3 w-3" />
                Hero {heroReady ? "\u2713" : "\u00B7"}
            </span>
            <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold",
                infraReady ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700/40 text-zinc-500"
            )} title={infraReady ? "Infographic ready" : "Infographic missing"}>
                <Image className="h-3 w-3" />
                Info {infraReady ? "\u2713" : "\u00B7"}
            </span>
            <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold",
                fbApproved ? "bg-blue-500/20 text-blue-300" : "bg-zinc-700/40 text-zinc-500"
            )} title={fbApproved ? `Facebook approved (${item.approved_facebook_posts || 0})` : "No approved Facebook posts"}>
                <ThumbsUp className="h-3 w-3" />
                FB {fbApproved ? "\u2713" : "\u00B7"}{item.approved_facebook_posts ? ` ${item.approved_facebook_posts}` : ""}
            </span>
            {allDone && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/20 text-cyan-300" title="All creative done">
                    <CheckCircle2 className="h-3 w-3" />
                    Done
                </span>
            )}
        </span>
    );
}

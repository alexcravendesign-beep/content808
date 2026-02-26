import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ContentItem } from "@/api/client";
import { campaignGoalLabel } from "@/lib/formatHelpers";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { User, ExternalLink, ArrowRight, Clock } from "lucide-react";
import { CreativeBadges } from "@/components/ui/CreativeBadges";
import { format } from "date-fns";

interface CalendarEventPopoverProps {
    item: ContentItem;
    anchorRect: DOMRect;
    onClose: () => void;
    onReschedule: (item: ContentItem) => void;
    onGenerateInfographic: (item: ContentItem) => void;
    onGenerateHero: (item: ContentItem) => void;
    onGenerateBoth: (item: ContentItem) => void;
    isGenerating?: boolean;
}

export function CalendarEventPopover({ item, anchorRect, onClose, onReschedule, onGenerateInfographic, onGenerateHero, onGenerateBoth, isGenerating = false }: CalendarEventPopoverProps) {
    const navigate = useNavigate();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const popWidth = 320;
        const popHeight = 320;
        let top = anchorRect.bottom + 8;
        let left = anchorRect.left;

        if (left + popWidth > window.innerWidth - 16) left = window.innerWidth - popWidth - 16;
        if (top + popHeight > window.innerHeight - 16) top = anchorRect.top - popHeight - 8;
        if (left < 16) left = 16;

        setPosition({ top, left });

        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [anchorRect, onClose]);

    return (
        <div
            ref={popoverRef}
            className="fixed z-[60] w-[320px] bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/40 animate-scaleIn overflow-hidden"
            style={{ top: position.top, left: position.left }}
        >
            {/* Product hero */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <ProductThumbnail item={item} size="lg" />
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[hsl(var(--th-text))] truncate">{item.product_title || item.brand}</h3>
                    {item.product_title && item.brand !== item.product_title && (
                        <p className="text-[11px] text-[hsl(var(--th-text-muted))]">{item.brand}</p>
                    )}
                    <div className="mt-1">
                        <StatusBadge status={item.status} size="sm" />
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="px-4 pb-3 space-y-1.5">
                {item.campaign_goal && (
                    <p className="text-xs text-[hsl(var(--th-text-secondary))] line-clamp-2">{campaignGoalLabel(item.campaign_goal)}</p>
                )}
                {item.assignee && (
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--th-text-muted))]">
                        <User className="h-3.5 w-3.5 text-[hsl(var(--th-text-muted))]" />
                        <span>{item.assignee}</span>
                    </div>
                )}
                {item.platform && (
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--th-text-muted))]">
                        <span className="text-[10px] uppercase tracking-wider bg-[hsl(var(--th-input))] px-2 py-0.5 rounded font-medium">{item.platform}</span>
                    </div>
                )}
                <CreativeBadges item={item} variant="detail" />
                {(item.publish_date || item.due_date) && (
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--th-text-muted))]">
                        <Clock className="h-3.5 w-3.5 text-[hsl(var(--th-text-muted))]" />
                        <span>
                            {item.publish_date
                                ? format(new Date(item.publish_date), "MMM d, yyyy h:mm a")
                                : item.due_date
                                    ? `Due: ${format(new Date(item.due_date), "MMM d, yyyy")}`
                                    : ""}
                        </span>
                    </div>
                )}
                {item.product_url && (
                    <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Product Link</span>
                    </a>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <button
                    onClick={() => navigate(`/item/${item.id}`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-medium hover:bg-indigo-600/30 transition-colors"
                >
                    View Detail
                    <ArrowRight className="h-3 w-3" />
                </button>
                <button
                    onClick={() => navigate(`/item/${item.id}?tab=outputs`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors"
                >
                    Outputs
                    <ArrowRight className="h-3 w-3" />
                </button>

                <button
                    onClick={() => onGenerateInfographic(item)}
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] text-xs font-medium hover:bg-[hsl(var(--th-surface-hover))] dark:bg-cyan-600/20 dark:text-cyan-300 dark:hover:bg-cyan-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? "Generating…" : "Gen Infographic"}
                </button>
                <button
                    onClick={() => onGenerateHero(item)}
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] text-xs font-medium hover:bg-[hsl(var(--th-surface-hover))] dark:bg-violet-600/20 dark:text-violet-300 dark:hover:bg-violet-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? "Generating…" : "Gen Hero"}
                </button>

                <button
                    onClick={() => onGenerateBoth(item)}
                    disabled={isGenerating}
                    className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] text-xs font-medium hover:bg-[hsl(var(--th-surface-hover))] dark:bg-amber-600/20 dark:text-amber-300 dark:hover:bg-amber-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? "Generating both…" : "Generate Both"}
                </button>

                <button
                    onClick={() => onReschedule(item)}
                    className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] text-xs font-medium hover:bg-[hsl(var(--th-surface-hover))] transition-colors"
                >
                    <Clock className="h-3 w-3" />
                    Reschedule
                </button>
            </div>
        </div>
    );
}

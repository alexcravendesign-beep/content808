import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ContentItem } from "@/api/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Calendar, User, ExternalLink, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";

interface CalendarEventPopoverProps {
    item: ContentItem;
    anchorRect: DOMRect;
    onClose: () => void;
    onReschedule: (item: ContentItem) => void;
}

export function CalendarEventPopover({ item, anchorRect, onClose, onReschedule }: CalendarEventPopoverProps) {
    const navigate = useNavigate();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const updatePosition = () => {
            const popWidth = 300;
            const popHeight = 260;
            let top = anchorRect.bottom + 8;
            let left = anchorRect.left;

            if (left + popWidth > window.innerWidth - 16) {
                left = window.innerWidth - popWidth - 16;
            }
            if (top + popHeight > window.innerHeight - 16) {
                top = anchorRect.top - popHeight - 8;
            }
            if (left < 16) left = 16;

            setPosition({ top, left });
        };

        updatePosition();

        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
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
            className="fixed z-[60] w-[300px] bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/40 animate-scaleIn overflow-hidden"
            style={{ top: position.top, left: position.left }}
        >
            {/* Header with gradient accent */}
            <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{item.brand}</h3>
                    <StatusBadge status={item.status} size="sm" />
                </div>
                {item.campaign_goal && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{item.campaign_goal}</p>
                )}
            </div>

            {/* Details */}
            <div className="px-4 pb-3 space-y-2">
                {item.assignee && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <User className="h-3.5 w-3.5 text-zinc-600" />
                        <span>{item.assignee}</span>
                    </div>
                )}
                {item.platform && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="capitalize">{item.platform}</span>
                    </div>
                )}
                {(item.publish_date || item.due_date) && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5 text-zinc-600" />
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
            <div className="flex gap-2 px-4 pb-4">
                <button
                    onClick={() => navigate(`/item/${item.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-medium hover:bg-indigo-600/30 transition-colors"
                >
                    View Detail
                    <ArrowRight className="h-3 w-3" />
                </button>
                <button
                    onClick={() => onReschedule(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
                >
                    <Clock className="h-3 w-3" />
                    Reschedule
                </button>
            </div>
        </div>
    );
}

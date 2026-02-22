import { ContentItem } from "@/api/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { format, parseISO, isSameDay, isToday as isDateToday, isTomorrow, addDays } from "date-fns";
import { Calendar, User } from "lucide-react";

interface CalendarAgendaViewProps {
    currentDate: Date;
    items: ContentItem[];
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
}

export function CalendarAgendaView({ items, onItemClick }: CalendarAgendaViewProps) {
    // Get items with dates, sorted chronologically
    const sortedItems = items
        .filter((i) => i.publish_date || i.due_date)
        .sort((a, b) => {
            const da = new Date(a.publish_date || a.due_date || "");
            const db = new Date(b.publish_date || b.due_date || "");
            return da.getTime() - db.getTime();
        });

    // Group by date
    const grouped: { date: Date; items: ContentItem[] }[] = [];
    const dateMap = new Map<string, ContentItem[]>();

    sortedItems.forEach((item) => {
        const d = item.publish_date || item.due_date;
        if (!d) return;
        const key = format(parseISO(d), "yyyy-MM-dd");
        if (!dateMap.has(key)) dateMap.set(key, []);
        dateMap.get(key)!.push(item);
    });

    dateMap.forEach((items, key) => {
        grouped.push({ date: parseISO(key), items });
    });

    const getDateLabel = (date: Date) => {
        if (isDateToday(date)) return "Today";
        if (isTomorrow(date)) return "Tomorrow";
        const yesterday = addDays(new Date(), -1);
        if (isSameDay(date, yesterday)) return "Yesterday";
        return format(date, "EEEE, MMMM d");
    };

    if (grouped.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--th-text-muted))] animate-fadeIn">
                <Calendar className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No scheduled items</p>
                <p className="text-xs text-[hsl(var(--th-text-muted))] mt-1">Items with dates will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {grouped.map(({ date, items }) => {
                const today = isDateToday(date);

                return (
                    <div key={format(date, "yyyy-MM-dd")}>
                        {/* Date header */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${today
                                ? "bg-indigo-500/15 text-indigo-400"
                                : "bg-[hsl(var(--th-surface))] text-[hsl(var(--th-text-secondary))]"
                                }`}>
                                <span>{getDateLabel(date)}</span>
                            </div>
                            {!today && (
                                <span className="text-[10px] text-[hsl(var(--th-text-muted))]">{format(date, "MMM d, yyyy")}</span>
                            )}
                            <span className="text-[10px] text-[hsl(var(--th-text-muted))]">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                        </div>

                        {/* Items — product-first */}
                        <div className="space-y-2 pl-1">
                            {items.map((item) => {
                                const d = item.publish_date || item.due_date;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={(e) => onItemClick(item, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                                        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] cursor-pointer hover:border-[hsl(var(--th-text-muted)/0.4)] hover:bg-[hsl(var(--th-surface-hover))] transition-all duration-200 group calendar-item"
                                    >
                                        {/* Time */}
                                        <div className="w-16 text-center shrink-0">
                                            {d && (
                                                <span className="text-xs font-medium text-[hsl(var(--th-text-secondary))] group-hover:text-[hsl(var(--th-text))] transition-colors">
                                                    {format(new Date(d), "h:mm a")}
                                                </span>
                                            )}
                                        </div>

                                        {/* Product thumbnail */}
                                        <ProductThumbnail item={item} size="md" />

                                        {/* Content — product-first */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-medium text-[hsl(var(--th-text))] truncate group-hover:text-[hsl(var(--th-text))] transition-colors">
                                                    {item.product_title || item.brand}
                                                </span>
                                                <StatusBadge status={item.status} size="sm" />
                                                {item.platform && (
                                                    <span className="text-[10px] text-[hsl(var(--th-text-muted))] uppercase tracking-wider shrink-0 bg-[hsl(var(--th-input))] px-1.5 py-0.5 rounded">
                                                        {item.platform}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[hsl(var(--th-text-muted))]">
                                                {item.product_title && item.brand !== item.product_title && (
                                                    <span>{item.brand}</span>
                                                )}
                                                {item.campaign_goal && (
                                                    <span className="truncate">{typeof item.campaign_goal === "string" ? item.campaign_goal : item.campaign_goal.title}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex items-center gap-3 shrink-0 text-[11px] text-[hsl(var(--th-text-muted))]">
                                            {item.assignee && (
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {item.assignee}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

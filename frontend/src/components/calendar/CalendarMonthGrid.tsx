import { ContentItem } from "@/api/client";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { CreativeBadges } from "@/components/ui/CreativeBadges";
import {
    format, startOfMonth, startOfWeek, endOfWeek, endOfMonth,
    addDays, isSameMonth, isSameDay, parseISO
} from "date-fns";

const STATUS_STRIP: Record<string, string> = {
    idea: "border-l-indigo-500", draft: "border-l-violet-500", review: "border-l-amber-500",
    approved: "border-l-emerald-500", blocked: "border-l-red-500", scheduled: "border-l-blue-500", published: "border-l-cyan-500",
    publishing: "border-l-amber-400", failed: "border-l-red-500",
};

interface CalendarMonthGridProps {
    currentDate: Date;
    items: ContentItem[];
    dragItem: ContentItem | null;
    onDragStart: (item: ContentItem) => void;
    onDragEnd: () => void;
    onDrop: (date: Date) => void;
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
    onCellClick: (date: Date) => void;
}

export function CalendarMonthGrid({
    currentDate, items, dragItem, onDragStart, onDragEnd, onDrop, onItemClick, onCellClick,
}: CalendarMonthGridProps) {
    const monthStart = startOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });

    const rows: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(day);
            day = addDays(day, 1);
        }
        rows.push(week);
    }

    const getItemsForDate = (date: Date) =>
        items.filter((item) => {
            const d = item.publish_date || item.due_date;
            return d && isSameDay(parseISO(d), date);
        });

    return (
        <div className="border border-[hsl(var(--th-border))] rounded-xl overflow-hidden animate-fadeIn">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-[hsl(var(--th-surface))]">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                    <div key={d} className="px-3 py-2.5 text-[11px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider text-center border-b border-[hsl(var(--th-border))]">
                        {d.slice(0, 3)}
                    </div>
                ))}
            </div>

            {/* Grid */}
            {rows.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                        const dayItems = getItemsForDate(day);
                        const isToday = isSameDay(day, new Date());
                        const inMonth = isSameMonth(day, currentDate);
                        return (
                            <div
                                key={di}
                                className={`min-h-[160px] border-b border-r border-[hsl(var(--th-border)/0.4)] p-2 transition-colors duration-150 calendar-cell-hover ${inMonth ? "" : "opacity-30"
                                    } ${dragItem ? "hover:bg-indigo-500/[0.06]" : ""}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onDrop(day)}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest("[data-calendar-item]")) return;
                                    onCellClick(day);
                                }}
                            >
                                {/* Date number */}
                                <div className="flex items-center justify-between mb-1 px-0.5">
                                    <span
                                        className={`text-xs font-medium flex items-center justify-center ${isToday
                                            ? "h-6 w-6 rounded-full bg-indigo-600 text-white"
                                            : "text-[hsl(var(--th-text-muted))]"
                                            }`}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {dayItems.length > 3 && (
                                        <span className="text-[10px] text-[hsl(var(--th-text-muted))] font-medium">
                                            {dayItems.length}
                                        </span>
                                    )}
                                </div>

                                {/* Product-first items */}
                                <div className="space-y-1">
                                    {dayItems.slice(0, 3).map((item) => (
                                        <div
                                            key={item.id}
                                            data-calendar-item
                                            draggable
                                            onDragStart={() => onDragStart(item)}
                                            onDragEnd={onDragEnd}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onItemClick(item, (e.currentTarget as HTMLElement).getBoundingClientRect());
                                            }}
                                            className={`flex items-center gap-2 px-1.5 py-1 rounded-md border-l-2 ${STATUS_STRIP[item.status] || "border-l-zinc-500"} bg-[hsl(var(--th-surface-hover))] hover:bg-[hsl(var(--th-input))] cursor-grab active:cursor-grabbing calendar-item transition-colors`}
                                        >
                                            <ProductThumbnail item={item} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-medium text-[hsl(var(--th-text))] truncate">
                                                    {item.product_title || item.brand}
                                                </div>
                                                    <div className="flex items-center gap-1">
                                                        {item.platform && (
                                                            <span className="text-[10px] text-[hsl(var(--th-text-muted))] uppercase">{item.platform}</span>
                                                        )}
                                                        <CreativeBadges item={item} variant="compact" />
                                                        {(item as unknown as { item_type?: string }).item_type === 'social_post' && (
                                                            <span className="inline-flex h-3 w-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" title="Social Post" />
                                                        )}
                                                    </div>
                                            </div>
                                        </div>
                                    ))}
                                    {dayItems.length > 3 && (
                                        <button
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 px-1.5 font-medium transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCellClick(day);
                                            }}
                                        >
                                            +{dayItems.length - 3} more
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

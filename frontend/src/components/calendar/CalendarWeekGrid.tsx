import { ContentItem } from "@/api/client";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import {
    format, startOfWeek, addDays, isSameDay, parseISO
} from "date-fns";
import { STATUS_STRIP, STATUS_DOT } from "@/lib/statusConfig";

interface CalendarWeekGridProps {
    currentDate: Date;
    items: ContentItem[];
    dragItem: ContentItem | null;
    onDragStart: (item: ContentItem) => void;
    onDragEnd: () => void;
    onDrop: (date: Date) => void;
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
    onCellClick: (date: Date) => void;
}

export function CalendarWeekGrid({
    currentDate, items, dragItem, onDragStart, onDragEnd, onDrop, onItemClick, onCellClick,
}: CalendarWeekGridProps) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    const getItemsForDate = (date: Date) =>
        items.filter((item) => {
            const d = item.publish_date || item.due_date;
            return d && isSameDay(parseISO(d), date);
        });

    return (
        <div className="grid grid-cols-7 gap-3 animate-fadeIn">
            {days.map((day, i) => {
                const dayItems = getItemsForDate(day);
                const isToday = isSameDay(day, new Date());
                return (
                    <div
                        key={i}
                        className={`rounded-xl border transition-all duration-200 ${isToday ? "border-indigo-500/30 shadow-lg shadow-indigo-500/5" : "border-[hsl(var(--th-border))]"
                            } min-h-[280px] ${dragItem ? "hover:border-indigo-500/20 hover:bg-indigo-500/[0.03]" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(day)}
                        onClick={(e) => {
                            if ((e.target as HTMLElement).closest("[data-calendar-item]")) return;
                            onCellClick(day);
                        }}
                    >
                        {/* Day header */}
                        <div className={`px-3 py-3 border-b transition-colors ${isToday ? "border-indigo-500/20 bg-indigo-500/[0.06]" : "border-[hsl(var(--th-border)/0.4)]"
                            }`}>
                            <div className="text-[10px] font-medium text-[hsl(var(--th-text-muted))] uppercase tracking-wider">{format(day, "EEE")}</div>
                            <div className={`text-xl font-bold ${isToday ? "text-indigo-400" : "text-[hsl(var(--th-text-secondary))]"}`}>
                                {format(day, "d")}
                            </div>
                            {dayItems.length > 0 && (
                                <div className="text-[10px] text-[hsl(var(--th-text-muted))] mt-0.5">{dayItems.length} item{dayItems.length !== 1 ? "s" : ""}</div>
                            )}
                        </div>

                        {/* Product-first items */}
                        <div className="p-2 space-y-2">
                            {dayItems.map((item) => (
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
                                    className={`border-l-2 ${STATUS_STRIP[item.status] || "border-l-zinc-500"} bg-[hsl(var(--th-surface-hover))] hover:bg-[hsl(var(--th-input))] rounded-lg p-2 cursor-grab active:cursor-grabbing calendar-item transition-colors`}
                                >
                                    <div className="flex items-start gap-2 mb-1.5">
                                        <ProductThumbnail item={item} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-medium text-[hsl(var(--th-text))] truncate">{item.product_title || item.brand}</div>
                                            <div className="text-[10px] text-[hsl(var(--th-text-muted))] truncate">{item.brand}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--th-text-secondary))]">
                                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status] || "bg-zinc-500"}`} />
                                        <span className="capitalize truncate">{item.status}</span>
                                        {item.platform && <span className="text-[hsl(var(--th-text-muted))]">· {item.platform}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

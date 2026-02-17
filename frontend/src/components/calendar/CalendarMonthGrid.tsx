import { ContentItem } from "@/api/client";
import {
    format, startOfMonth, startOfWeek, endOfWeek, endOfMonth,
    addDays, isSameMonth, isSameDay, parseISO
} from "date-fns";

const STATUS_BG: Record<string, string> = {
    idea: "bg-indigo-500", draft: "bg-violet-500", review: "bg-amber-500",
    approved: "bg-emerald-500", blocked: "bg-red-500", scheduled: "bg-blue-500", published: "bg-cyan-500",
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
        <div className="border border-zinc-800/50 rounded-xl overflow-hidden animate-fadeIn">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-zinc-900/50">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                    <div key={d} className="px-3 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center border-b border-zinc-800/40">
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
                                className={`min-h-[110px] border-b border-r border-zinc-800/30 p-1.5 transition-colors duration-150 calendar-cell-hover ${inMonth ? "" : "opacity-30"
                                    } ${dragItem ? "hover:bg-indigo-500/[0.06]" : ""}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onDrop(day)}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest("[data-calendar-item]")) return;
                                    onCellClick(day);
                                }}
                            >
                                {/* Date number */}
                                <div className="flex items-center justify-between mb-1 px-1">
                                    <span
                                        className={`text-xs font-medium flex items-center justify-center ${isToday
                                            ? "h-6 w-6 rounded-full bg-indigo-600 text-white"
                                            : "text-zinc-500"
                                            }`}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {dayItems.length > 3 && (
                                        <span className="text-[10px] text-zinc-600 font-medium">
                                            {dayItems.length} items
                                        </span>
                                    )}
                                </div>

                                {/* Items */}
                                <div className="space-y-0.5">
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
                                            className={`${STATUS_BG[item.status] || "bg-zinc-600"} text-white text-[10px] px-2 py-[3px] rounded-md truncate cursor-grab active:cursor-grabbing calendar-item flex items-center gap-1`}
                                        >
                                            <span className="truncate font-medium">{item.brand}</span>
                                            {item.platform && (
                                                <span className="text-white/50 text-[9px] shrink-0">· {item.platform}</span>
                                            )}
                                        </div>
                                    ))}
                                    {dayItems.length > 3 && (
                                        <button
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 font-medium transition-colors"
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

import { ContentItem } from "@/api/client";
import {
    format, startOfWeek, addDays, isSameDay, parseISO
} from "date-fns";

const STATUS_BG: Record<string, string> = {
    idea: "bg-indigo-500", draft: "bg-violet-500", review: "bg-amber-500",
    approved: "bg-emerald-500", blocked: "bg-red-500", scheduled: "bg-blue-500", published: "bg-cyan-500",
};

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
                        className={`rounded-xl border transition-all duration-200 ${isToday ? "border-indigo-500/30 shadow-lg shadow-indigo-500/5" : "border-zinc-800/50"
                            } min-h-[240px] ${dragItem ? "hover:border-indigo-500/20 hover:bg-indigo-500/[0.03]" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(day)}
                        onClick={(e) => {
                            if ((e.target as HTMLElement).closest("[data-calendar-item]")) return;
                            onCellClick(day);
                        }}
                    >
                        {/* Day header */}
                        <div className={`px-3 py-3 border-b transition-colors ${isToday ? "border-indigo-500/20 bg-indigo-500/[0.06]" : "border-zinc-800/30"
                            }`}>
                            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{format(day, "EEE")}</div>
                            <div className={`text-xl font-bold ${isToday ? "text-indigo-400" : "text-zinc-300"}`}>
                                {format(day, "d")}
                            </div>
                            {dayItems.length > 0 && (
                                <div className="text-[10px] text-zinc-600 mt-0.5">{dayItems.length} item{dayItems.length !== 1 ? "s" : ""}</div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="p-2 space-y-1.5">
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
                                    className={`${STATUS_BG[item.status] || "bg-zinc-600"} text-white text-xs px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing calendar-item`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="font-medium truncate">{item.brand}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-white/60">
                                        {item.platform && <span className="capitalize">{item.platform}</span>}
                                        {item.assignee && <span>· {item.assignee}</span>}
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

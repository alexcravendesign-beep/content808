import { ContentItem } from "@/api/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, isSameDay, parseISO } from "date-fns";

const STATUS_BG: Record<string, string> = {
    idea: "bg-indigo-500/20 border-indigo-500/30",
    draft: "bg-violet-500/20 border-violet-500/30",
    review: "bg-amber-500/20 border-amber-500/30",
    approved: "bg-emerald-500/20 border-emerald-500/30",
    blocked: "bg-red-500/20 border-red-500/30",
    scheduled: "bg-blue-500/20 border-blue-500/30",
    published: "bg-cyan-500/20 border-cyan-500/30",
};

const STATUS_TEXT: Record<string, string> = {
    idea: "text-indigo-300", draft: "text-violet-300", review: "text-amber-300",
    approved: "text-emerald-300", blocked: "text-red-300", scheduled: "text-blue-300", published: "text-cyan-300",
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

interface CalendarDayViewProps {
    currentDate: Date;
    items: ContentItem[];
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
    onSlotClick: (date: Date) => void;
}

export function CalendarDayView({ currentDate, items, onItemClick, onSlotClick }: CalendarDayViewProps) {
    const isToday = isSameDay(currentDate, new Date());

    const dayItems = items.filter((item) => {
        const d = item.publish_date || item.due_date;
        return d && isSameDay(parseISO(d), currentDate);
    });

    // Group items by hour
    const itemsByHour: Record<number, ContentItem[]> = {};
    dayItems.forEach((item) => {
        const d = item.publish_date || item.due_date;
        if (!d) return;
        const hour = new Date(d).getHours();
        if (!itemsByHour[hour]) itemsByHour[hour] = [];
        itemsByHour[hour].push(item);
    });

    // Items without specific time go to "All Day"
    const allDay = dayItems.filter((item) => {
        const d = item.publish_date || item.due_date;
        if (!d) return false;
        const dateStr = d;
        return dateStr.endsWith("T00:00:00.000Z") || dateStr.length === 10;
    });

    const nowHour = new Date().getHours();
    const nowMinute = new Date().getMinutes();

    return (
        <div className="animate-fadeIn">
            {/* Day header */}
            <div className={`flex items-center gap-4 mb-4 px-2 py-3 rounded-xl ${isToday ? "bg-indigo-500/[0.06] border border-indigo-500/20" : "bg-zinc-900/40 border border-zinc-800/30"
                }`}>
                <div className={`text-3xl font-bold ${isToday ? "text-indigo-400" : "text-zinc-300"}`}>
                    {format(currentDate, "d")}
                </div>
                <div>
                    <div className={`text-sm font-semibold ${isToday ? "text-indigo-300" : "text-zinc-300"}`}>
                        {format(currentDate, "EEEE")}
                    </div>
                    <div className="text-xs text-zinc-500">{format(currentDate, "MMMM yyyy")}</div>
                </div>
                <div className="ml-auto text-xs text-zinc-500">
                    {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* All day items */}
            {allDay.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-2 border-b border-zinc-800/30">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-16">All Day</span>
                        <div className="flex-1 flex flex-wrap gap-1.5">
                            {allDay.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={(e) => onItemClick(item, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                                    className={`${STATUS_BG[item.status] || "bg-zinc-800 border-zinc-700"} border rounded-lg px-3 py-1.5 text-xs font-medium ${STATUS_TEXT[item.status] || "text-zinc-300"} hover:opacity-80 transition-opacity`}
                                >
                                    {item.brand}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Time grid */}
            <div className="relative">
                {HOURS.map((hour) => {
                    const hourItems = (itemsByHour[hour] || []).filter((i) => !allDay.includes(i));
                    const isNowHour = isToday && hour === nowHour;

                    return (
                        <div
                            key={hour}
                            className="flex border-b border-zinc-800/20 min-h-[52px] group relative"
                            onClick={() => {
                                const d = new Date(currentDate);
                                d.setHours(hour, 0, 0, 0);
                                onSlotClick(d);
                            }}
                        >
                            {/* Time label */}
                            <div className="w-16 shrink-0 py-2 px-2 text-right">
                                <span className={`text-[11px] font-medium ${isNowHour ? "text-indigo-400" : "text-zinc-600"}`}>
                                    {format(new Date(2000, 0, 1, hour), "h a")}
                                </span>
                            </div>

                            {/* Slot */}
                            <div className="flex-1 py-1 px-2 cursor-pointer hover:bg-white/[0.02] transition-colors">
                                {hourItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onItemClick(item, (e.currentTarget as HTMLElement).getBoundingClientRect());
                                        }}
                                        className={`${STATUS_BG[item.status] || "bg-zinc-800 border-zinc-700"} border rounded-lg px-3 py-2 mb-1 cursor-pointer calendar-item`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium ${STATUS_TEXT[item.status] || "text-zinc-300"}`}>
                                                {item.brand}
                                            </span>
                                            <StatusBadge status={item.status} size="sm" />
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                                            {item.platform && <span className="capitalize">{item.platform}</span>}
                                            {item.assignee && <span>{item.assignee}</span>}
                                            {item.publish_date && (
                                                <span>{format(new Date(item.publish_date), "h:mm a")}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Hover hint */}
                                {hourItems.length === 0 && (
                                    <div className="h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] text-zinc-700">Click to add item</span>
                                    </div>
                                )}
                            </div>

                            {/* Now indicator line */}
                            {isNowHour && (
                                <div
                                    className="absolute left-14 right-0 h-[2px] bg-indigo-500 z-10 pointer-events-none"
                                    style={{ top: `${(nowMinute / 60) * 100}%` }}
                                >
                                    <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-indigo-500" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

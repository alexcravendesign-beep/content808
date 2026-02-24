import { ContentItem } from "@/api/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { format, isSameDay, parseISO } from "date-fns";
import { STATUS_BG_LIGHT as STATUS_BG } from "@/lib/statusConfig";

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

    // All-day items (midnight timestamps or date-only strings)
    const allDay = dayItems.filter((item) => {
        const d = item.publish_date || item.due_date;
        if (!d) return false;
        return d.endsWith("T00:00:00.000Z") || d.length === 10;
    });

    const nowHour = new Date().getHours();
    const nowMinute = new Date().getMinutes();

    return (
        <div className="animate-fadeIn">
            {/* Day header */}
            <div className={`flex items-center gap-4 mb-4 px-4 py-3 rounded-xl ${isToday ? "bg-indigo-500/[0.06] border border-indigo-500/20" : "bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))]"
                }`}>
                <div className={`text-3xl font-bold ${isToday ? "text-indigo-400" : "text-[hsl(var(--th-text-secondary))]"}`}>
                    {format(currentDate, "d")}
                </div>
                <div>
                    <div className={`text-sm font-semibold ${isToday ? "text-indigo-300" : "text-[hsl(var(--th-text))]"}`}>
                        {format(currentDate, "EEEE")}
                    </div>
                    <div className="text-xs text-[hsl(var(--th-text-muted))]">{format(currentDate, "MMMM yyyy")}</div>
                </div>
                <div className="ml-auto text-xs text-[hsl(var(--th-text-muted))]">
                    {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* All day items */}
            {allDay.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-start gap-3 px-2 py-2 border-b border-[hsl(var(--th-border))]">
                        <span className="text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider w-16 pt-1 text-right">All Day</span>
                        <div className="flex-1 flex flex-wrap gap-2">
                            {allDay.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={(e) => onItemClick(item, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                                    className={`flex items-center gap-2 ${STATUS_BG[item.status] || "bg-[hsl(var(--th-surface-hover))] border-[hsl(var(--th-border))]"} border rounded-lg px-3 py-2 hover:opacity-80 transition-opacity`}
                                >
                                    <ProductThumbnail item={item} size="sm" />
                                    <span className="text-xs font-medium text-[hsl(var(--th-text))]">{item.product_title || item.brand}</span>
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
                            className="flex border-b border-[hsl(var(--th-border)/0.3)] min-h-[56px] group relative"
                            onClick={() => {
                                const d = new Date(currentDate);
                                d.setHours(hour, 0, 0, 0);
                                onSlotClick(d);
                            }}
                        >
                            {/* Time label */}
                            <div className="w-16 shrink-0 py-2 px-2 text-right">
                                <span className={`text-[11px] font-medium ${isNowHour ? "text-indigo-400" : "text-[hsl(var(--th-text-muted))]"}`}>
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
                                        className={`${STATUS_BG[item.status] || "bg-[hsl(var(--th-surface-hover))] border-[hsl(var(--th-border))]"} border rounded-lg px-3 py-2 mb-1 cursor-pointer calendar-item`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <ProductThumbnail item={item} size="md" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-[hsl(var(--th-text))] truncate">
                                                        {item.product_title || item.brand}
                                                    </span>
                                                    <StatusBadge status={item.status} size="sm" />
                                                    <span className={`h-2 w-2 rounded-full ${item.has_hero ? 'bg-fuchsia-400' : 'bg-zinc-600'}`} title={item.has_hero ? 'Hero done' : 'Hero missing'} />
                                                    <span className={`h-2 w-2 rounded-full ${item.has_infographic ? 'bg-emerald-400' : 'bg-zinc-600'}`} title={item.has_infographic ? 'Infographic done' : 'Infographic missing'} />
                                                    <span className={`h-2 w-2 rounded-full ${item.has_facebook_approved ? 'bg-green-400' : 'bg-zinc-600'}`} title={item.has_facebook_approved ? `Facebook approved (${item.approved_facebook_posts || 0})` : 'No approved Facebook posts'} />
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[hsl(var(--th-text-muted))]">
                                                    <span>{item.brand}</span>
                                                    {item.platform && <span className="capitalize">{item.platform}</span>}
                                                    {item.assignee && <span>{item.assignee}</span>}
                                                    {item.publish_date && (
                                                        <span>{format(new Date(item.publish_date), "h:mm a")}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Hover hint */}
                                {hourItems.length === 0 && (
                                    <div className="h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] text-[hsl(var(--th-text-muted))]">Click to add item</span>
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

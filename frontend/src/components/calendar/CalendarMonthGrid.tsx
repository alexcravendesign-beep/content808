import { useState, useRef, useEffect } from "react";
import { ContentItem } from "@/api/client";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { CreativeBadges } from "@/components/ui/CreativeBadges";
import {
    format, startOfMonth, startOfWeek, endOfWeek, endOfMonth,
    addDays, isSameMonth, isSameDay, parseISO, getISOWeek
} from "date-fns";

const STATUS_STRIP: Record<string, string> = {
    idea: "border-l-indigo-500", draft: "border-l-violet-500", review: "border-l-amber-500",
    approved: "border-l-emerald-500", blocked: "border-l-red-500", scheduled: "border-l-blue-500", published: "border-l-cyan-500",
    publishing: "border-l-amber-400", failed: "border-l-red-500",
};

const BRAND_STRIP = (brand?: string) => {
    const b = (brand || "").toLowerCase();
    if (b.includes("craven cooling")) return "border-l-orange-500";
    if (b.includes("fridgesmart")) return "border-l-sky-500";
    return "";
};

const WEEK_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#f97316", "#ec4899"];

/* ── Hex to rgba helper ── */
function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(100,100,100,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Inline week-meta popover ── */
function WeekMetaPopover({
    weekKey, meta, color, onClose, onChange,
}: {
    weekKey: string;
    meta: { label?: string; theme?: string; color?: string };
    color: string;
    onClose: () => void;
    onChange: (weekKey: string, patch: { label?: string; theme?: string; color?: string }) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] shadow-xl shadow-black/20 p-3 space-y-2.5 animate-scaleIn"
            style={{ transformOrigin: "left top" }}
        >
            <div>
                <label className="block text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-1">Label</label>
                <input
                    value={meta.label || ""}
                    onChange={(e) => onChange(weekKey, { label: e.target.value })}
                    className="w-full h-7 px-2 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[11px] text-[hsl(var(--th-text))] outline-none focus:ring-1 focus:ring-indigo-500/40"
                    placeholder="Week label"
                />
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-1">Theme</label>
                <input
                    value={meta.theme || ""}
                    onChange={(e) => onChange(weekKey, { theme: e.target.value })}
                    className="w-full h-7 px-2 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[11px] text-[hsl(var(--th-text))] outline-none focus:ring-1 focus:ring-indigo-500/40"
                    placeholder="Week theme"
                />
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider mb-1">Color</label>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => onChange(weekKey, { color: e.target.value })}
                        className="h-7 w-10 rounded-md border border-[hsl(var(--th-border))] bg-transparent p-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-[hsl(var(--th-text-muted))] font-mono">{color}</span>
                </div>
            </div>
        </div>
    );
}

interface CalendarMonthGridProps {
    currentDate: Date;
    items: ContentItem[];
    dragItem: ContentItem | null;
    onDragStart: (item: ContentItem) => void;
    onDragEnd: () => void;
    onDrop: (date: Date) => void;
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
    onCellClick: (date: Date) => void;
    weekMeta?: Record<string, { label?: string; theme?: string; color?: string }>;
    onWeekMetaChange?: (weekKey: string, patch: { label?: string; theme?: string; color?: string }) => void;
}

export function CalendarMonthGrid({
    currentDate, items, dragItem, onDragStart, onDragEnd, onDrop, onItemClick, onCellClick, weekMeta = {}, onWeekMetaChange,
}: CalendarMonthGridProps) {
    const [openPopover, setOpenPopover] = useState<string | null>(null);

    const monthStart = startOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

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
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                    <div key={d} className="px-3 py-2.5 text-[11px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider text-center border-b border-[hsl(var(--th-border))]">
                        {d.slice(0, 3)}
                    </div>
                ))}
            </div>

            {/* Week rows */}
            {rows.map((week, wi) => {
                const weekKey = format(week[0], "yyyy-MM-dd");
                const meta = weekMeta[weekKey] || {};
                const color = meta.color || WEEK_COLORS[wi % WEEK_COLORS.length];
                const label = meta.label || `Week ${getISOWeek(week[0])}`;
                const theme = meta.theme || "";

                return (
                    <div key={wi} className="relative">
                        {/* ── Full-row week background tint ── */}
                        <div
                            className="absolute inset-0 pointer-events-none transition-colors duration-300"
                            style={{ background: hexToRgba(color, 0.045) }}
                        />

                        {/* ── Colored left accent bar ── */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1 z-10 transition-colors duration-300"
                            style={{ background: color }}
                        />

                        {/* ── Week label badge ── */}
                        <div className="absolute left-2.5 top-1 z-20">
                            <button
                                onClick={() => setOpenPopover(openPopover === weekKey ? null : weekKey)}
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-200 hover:scale-105 cursor-pointer"
                                style={{
                                    background: hexToRgba(color, 0.15),
                                    color: color,
                                    border: `1px solid ${hexToRgba(color, 0.25)}`,
                                }}
                                title="Click to edit week label, theme & color"
                            >
                                <span
                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                    style={{ background: color }}
                                />
                                {label}
                                {theme && (
                                    <span className="text-[9px] font-medium opacity-80 ml-0.5">
                                        / {theme}
                                    </span>
                                )}
                            </button>

                            {/* Popover for editing */}
                            {openPopover === weekKey && onWeekMetaChange && (
                                <WeekMetaPopover
                                    weekKey={weekKey}
                                    meta={meta}
                                    color={color}
                                    onClose={() => setOpenPopover(null)}
                                    onChange={onWeekMetaChange}
                                />
                            )}
                        </div>

                        {/* ── Day cells grid ── */}
                        <div className="grid grid-cols-7 relative">
                            {week.map((dayDate, di) => {
                                const dayItems = getItemsForDate(dayDate);
                                const isToday = isSameDay(dayDate, new Date());
                                const inMonth = isSameMonth(dayDate, currentDate);
                                return (
                                    <div
                                        key={di}
                                        className={`min-h-[140px] border-b border-r border-[hsl(var(--th-border)/0.3)] px-2 pt-7 pb-2 transition-colors duration-150 calendar-cell-hover ${inMonth ? "" : "opacity-30"
                                            } ${dragItem ? "hover:bg-indigo-500/[0.06]" : ""}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => onDrop(dayDate)}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest("[data-calendar-item]")) return;
                                            onCellClick(dayDate);
                                        }}
                                    >
                                        {/* Date number */}
                                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                                            <span
                                                className={`text-xs font-semibold flex items-center justify-center ${isToday
                                                    ? "h-6 w-6 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                                    : "text-[hsl(var(--th-text-muted))]"
                                                    }`}
                                            >
                                                {format(dayDate, "d")}
                                            </span>
                                            {dayItems.length > 3 && (
                                                <span className="text-[10px] text-[hsl(var(--th-text-muted))] font-medium tabular-nums">
                                                    {dayItems.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Content items */}
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
                                                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md border-l-2 ${BRAND_STRIP(item.brand) || STATUS_STRIP[item.status] || "border-l-zinc-500"} bg-[hsl(var(--th-surface)/0.85)] backdrop-blur-sm hover:bg-[hsl(var(--th-surface-hover))] cursor-grab active:cursor-grabbing calendar-item transition-all duration-150 shadow-sm shadow-[hsl(var(--th-shadow))]`}
                                                >
                                                    <ProductThumbnail item={item} size="sm" />
                                                    <div className="min-w-0 flex-1 overflow-hidden">
                                                        <div className="text-[11px] font-medium text-[hsl(var(--th-text))] truncate leading-tight">
                                                            {item.product_title || item.brand}
                                                        </div>
                                                        <div className="flex items-center gap-1 overflow-hidden">
                                                            {item.platform && (
                                                                <span className="text-[9px] text-[hsl(var(--th-text-muted))] uppercase flex-shrink-0">{item.platform}</span>
                                                            )}
                                                            <CreativeBadges item={item} variant="compact" />
                                                            {(item as unknown as { item_type?: string }).item_type === 'social_post' && (
                                                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex-shrink-0" title="Social Post" />
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
                                                        onCellClick(dayDate);
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
                    </div>
                );
            })}
        </div>
    );
}

import { useState, useRef, useEffect } from "react";
import { ContentItem, CalendarNote } from "@/api/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";
import { noteColorClass } from "@/components/calendar/NoteFormModal";
import { format, isSameDay, parseISO } from "date-fns";
import { STATUS_BG_LIGHT as STATUS_BG } from "@/lib/statusConfig";
import { CreativeBadges } from "@/components/ui/CreativeBadges";
import { StickyNote, Plus, FileText, Lock, Pencil, Trash2 } from "lucide-react";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

/** Inline "Add Note / Add Item" popover when clicking an empty slot */
function SlotActionMenu({ anchorRect, onAddNote, onAddItem, onClose }: {
    anchorRect: DOMRect;
    onAddNote: () => void;
    onAddItem: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [onClose]);

    const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 120);
    const left = Math.min(anchorRect.left, window.innerWidth - 200);

    return (
        <div
            ref={ref}
            className="fixed z-50 w-48 py-1 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] shadow-xl shadow-black/20 animate-fadeIn"
            style={{ top, left }}
        >
            <button
                onClick={() => { onAddNote(); onClose(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-colors"
            >
                <StickyNote className="h-3.5 w-3.5 text-amber-400" />
                Add Note
            </button>
            <button
                onClick={() => { onAddItem(); onClose(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-colors"
            >
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                Add Content Item
            </button>
        </div>
    );
}

interface CalendarDayViewProps {
    currentDate: Date;
    items: ContentItem[];
    notes?: CalendarNote[];
    onItemClick: (item: ContentItem, rect: DOMRect) => void;
    onSlotClick: (date: Date) => void;
    onAddNote?: (date: Date) => void;
    onEditNote?: (note: CalendarNote) => void;
    onDeleteNote?: (note: CalendarNote) => void;
}

export function CalendarDayView({ currentDate, items, notes = [], onItemClick, onSlotClick, onAddNote, onEditNote, onDeleteNote }: CalendarDayViewProps) {
    const isToday = isSameDay(currentDate, new Date());
    const [slotMenu, setSlotMenu] = useState<{ rect: DOMRect; date: Date } | null>(null);

    const dayItems = items.filter((item) => {
        const d = item.publish_date || item.due_date;
        return d && isSameDay(parseISO(d), currentDate);
    });

    const dayNotes = notes.filter((n) => {
        try {
            return isSameDay(parseISO(n.date), currentDate);
        } catch {
            return false;
        }
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
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-[hsl(var(--th-text-muted))]">
                        {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
                        {dayNotes.length > 0 && ` \u00B7 ${dayNotes.length} note${dayNotes.length !== 1 ? "s" : ""}`}
                    </span>
                    {onAddNote && (
                        <button
                            onClick={() => onAddNote(currentDate)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                        >
                            <Plus className="h-3 w-3" />
                            Note
                        </button>
                    )}
                </div>
            </div>

            {/* Notes section */}
            {dayNotes.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 px-2">
                        <StickyNote className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] font-semibold text-[hsl(var(--th-text-muted))] uppercase tracking-wider">Notes</span>
                    </div>
                    <div className="space-y-2 px-2 mb-4">
                        {dayNotes.map((note) => (
                            <div
                                key={note.id}
                                className={`group relative rounded-xl border px-4 py-3 transition-all hover:shadow-md ${noteColorClass(note.color)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <StickyNote className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-[hsl(var(--th-text))] whitespace-pre-wrap leading-relaxed">
                                            {note.note}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[hsl(var(--th-text-muted))]">
                                            <span>{note.created_by}</span>
                                            {note.visibility === "private" && (
                                                <span className="flex items-center gap-0.5 text-amber-400">
                                                    <Lock className="h-2.5 w-2.5" />
                                                    Private
                                                </span>
                                            )}
                                            {note.color && (
                                                <span className="capitalize">{note.color}</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Edit/delete actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onEditNote && (
                                            <button
                                                onClick={() => onEditNote(note)}
                                                className="p-1 rounded hover:bg-white/10 text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text))] transition-colors"
                                                title="Edit note"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        )}
                                        {onDeleteNote && (
                                            <button
                                                onClick={() => onDeleteNote(note)}
                                                className="p-1 rounded hover:bg-red-500/10 text-[hsl(var(--th-text-muted))] hover:text-red-400 transition-colors"
                                                title="Delete note"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                onClick={(e) => {
                                    const d = new Date(currentDate);
                                    d.setHours(hour, 0, 0, 0);
                                    if (onAddNote) {
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setSlotMenu({ rect, date: d });
                                    } else {
                                        onSlotClick(d);
                                    }
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
                                                    <CreativeBadges item={item} variant="inline" />
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
                                        <span className="text-[10px] text-[hsl(var(--th-text-muted))]">
                                            {onAddNote ? "Click to add note or item" : "Click to add item"}
                                        </span>
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

            {/* Slot action menu */}
            {slotMenu && (
                <SlotActionMenu
                    anchorRect={slotMenu.rect}
                    onAddNote={() => onAddNote?.(slotMenu.date)}
                    onAddItem={() => onSlotClick(slotMenu.date)}
                    onClose={() => setSlotMenu(null)}
                />
            )}
        </div>
    );
}

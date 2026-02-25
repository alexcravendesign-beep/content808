import { useState, useRef, useEffect } from "react";
import { Search, X, CalendarDays, CalendarRange, Clock, List, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
    format, startOfMonth, startOfWeek, addDays, addMonths, subMonths,
    isSameMonth, isSameDay
} from "date-fns";

type ViewMode = "month" | "week" | "day" | "agenda";

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: "month", label: "Month", icon: CalendarDays },
    { id: "week", label: "Week", icon: CalendarRange },
    { id: "day", label: "Day", icon: Clock },
    { id: "agenda", label: "Agenda", icon: List },
];

interface CalendarFilterBarProps {
    filters: {
        brand: string;
        platform: string;
        status: string;
        assignee: string;
    };
    onChange: (filters: CalendarFilterBarProps["filters"]) => void;
    view: ViewMode;
    onViewChange: (view: ViewMode) => void;
    dateTitle: string;
    onNavigateDate: (dir: number) => void;
    currentDate: Date;
    onDateSelect: (date: Date) => void;
}

const PLATFORMS = ["", "instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin", "email", "blog"];
const STATUSES = ["", "idea", "draft", "review", "approved", "blocked", "scheduled", "published"];

function MiniCalendarPicker({ currentDate, onDateSelect, onClose }: {
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    onClose: () => void;
}) {
    const [miniMonth, setMiniMonth] = useState(currentDate);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
    }, [onClose]);

    const monthStart = startOfMonth(miniMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const rows: Date[][] = [];
    let day = calStart;
    for (let w = 0; w < 6; w++) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(day);
            day = addDays(day, 1);
        }
        rows.push(week);
    }

    return (
        <div
            ref={ref}
            className="absolute top-full left-0 mt-1 z-50 w-64 p-3 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] shadow-xl shadow-black/20 animate-fadeIn"
        >
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => setMiniMonth(subMonths(miniMonth, 1))}
                    className="p-1 rounded-md hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] transition-colors"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-semibold text-[hsl(var(--th-text-secondary))]">
                    {format(miniMonth, "MMMM yyyy")}
                </span>
                <button
                    onClick={() => setMiniMonth(addMonths(miniMonth, 1))}
                    className="p-1 rounded-md hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] transition-colors"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-0 mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-medium text-[hsl(var(--th-text-muted))] py-1">{d}</div>
                ))}
            </div>

            {rows.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0">
                    {week.map((d, di) => {
                        const inMonth = isSameMonth(d, miniMonth);
                        const isToday = isSameDay(d, new Date());
                        const isSelected = isSameDay(d, currentDate);

                        return (
                            <button
                                key={di}
                                onClick={() => {
                                    onDateSelect(d);
                                    onClose();
                                }}
                                className={`relative h-7 w-full flex items-center justify-center text-[11px] rounded-md transition-all duration-150 ${!inMonth ? "text-[hsl(var(--th-text-muted))]" :
                                    isSelected ? "bg-indigo-600 text-white font-semibold" :
                                        isToday ? "text-indigo-400 font-semibold bg-indigo-500/10" :
                                            "text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]"
                                    }`}
                            >
                                {format(d, "d")}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function CalendarFilterBar({
    filters, onChange, view, onViewChange, dateTitle, onNavigateDate, currentDate, onDateSelect,
}: CalendarFilterBarProps) {
    const set = (key: keyof typeof filters, value: string) =>
        onChange({ ...filters, [key]: value });

    const hasFilters = filters.brand || filters.platform || filters.status || filters.assignee;

    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Brand search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--th-text-muted))] pointer-events-none" />
                <input
                    type="text"
                    value={filters.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="Brand..."
                    className="h-8 pl-8 pr-3 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-36 transition-shadow"
                />
            </div>

            {/* Platform */}
            <select
                value={filters.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-shadow"
            >
                <option value="">All Platforms</option>
                {PLATFORMS.filter(Boolean).map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
            </select>

            {/* Status */}
            <select
                value={filters.status}
                onChange={(e) => set("status", e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-shadow"
            >
                <option value="">All Statuses</option>
                {STATUSES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
            </select>

            {/* Assignee */}
            <input
                type="text"
                value={filters.assignee}
                onChange={(e) => set("assignee", e.target.value)}
                placeholder="Assignee..."
                className="h-8 px-3 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-28 transition-shadow"
            />

            {/* Clear */}
            {hasFilters && (
                <button
                    onClick={() => onChange({ brand: "", platform: "", status: "", assignee: "" })}
                    className="flex items-center gap-1 h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-input))] transition-colors"
                >
                    <X className="h-3 w-3" />
                    Clear
                </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date navigation */}
            <div className="flex items-center gap-1">
                <button onClick={() => onNavigateDate(-1)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-[hsl(var(--th-text-secondary))] min-w-[140px] text-center">{dateTitle}</span>
                <button onClick={() => onNavigateDate(1)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] transition-colors">
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Calendar picker button */}
            <div className="relative">
                <button
                    onClick={() => setPickerOpen((prev) => !prev)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-all"
                    title="Pick a date"
                >
                    <Calendar className="h-4 w-4" />
                </button>
                {pickerOpen && (
                    <MiniCalendarPicker
                        currentDate={currentDate}
                        onDateSelect={onDateSelect}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
            </div>

            {/* View switcher (Month / Week / Day / Agenda) */}
            <div className="flex rounded-xl border border-[hsl(var(--th-border))] overflow-hidden glass-panel">
                {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => onViewChange(id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                            view === id
                                ? "bg-gradient-to-r from-indigo-600/30 to-cyan-600/20 text-white"
                                : "text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

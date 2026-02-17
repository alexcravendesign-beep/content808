import { useState, useEffect, useCallback } from "react";
import { api, ContentItem } from "@/api/client";
import { useToast } from "@/components/ui/toast";
import { ItemFormModal } from "@/components/ItemFormModal";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, CalendarRange, Clock, List } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfDay
} from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Calendar sub-components
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/calendar/CalendarWeekGrid";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { CalendarEventPopover } from "@/components/calendar/CalendarEventPopover";
import { CalendarSkeleton } from "@/components/calendar/CalendarSkeleton";

type ViewMode = "month" | "week" | "day" | "agenda";

const VIEW_CONFIG: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "month", label: "Month", icon: CalendarDays },
  { id: "week", label: "Week", icon: CalendarRange },
  { id: "day", label: "Day", icon: Clock },
  { id: "agenda", label: "Agenda", icon: List },
];

export function CalendarPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [dragItem, setDragItem] = useState<ContentItem | null>(null);

  // Popover state
  const [popover, setPopover] = useState<{ item: ContentItem; rect: DOMRect } | null>(null);

  // Reschedule modal
  const [editModal, setEditModal] = useState<{ open: boolean; item: ContentItem | null; date: string }>({
    open: false, item: null, date: "",
  });

  // Create modal with pre-filled date
  const [createModal, setCreateModal] = useState<{ open: boolean; date: Date | null }>({ open: false, date: null });

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      let start: Date, end: Date;
      if (view === "month") {
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      } else if (view === "week") {
        start = startOfWeek(currentDate, { weekStartsOn: 0 });
        end = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else if (view === "day") {
        start = startOfDay(currentDate);
        end = addDays(start, 1);
      } else {
        // agenda — fetch wider range
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      }
      const data = await api.getCalendar({ start: start.toISOString(), end: end.toISOString() });
      setItems(data.items);
    } catch {
      toast("Failed to load calendar", "error");
    } finally {
      setLoading(false);
    }
  }, [currentDate, view, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Navigation
  const navigateDate = (dir: number) => {
    switch (view) {
      case "month":
        setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(dir > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case "agenda":
        setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
    }
  };

  const getTitle = () => {
    switch (view) {
      case "month": return format(currentDate, "MMMM yyyy");
      case "week": return `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`;
      case "day": return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda": return format(currentDate, "MMMM yyyy");
    }
  };

  // Drag and drop
  const handleDrop = async (date: Date) => {
    if (!dragItem) return;
    const newDate = startOfDay(date).toISOString();
    try {
      await api.rescheduleItem(dragItem.id, { publish_date: newDate });
      toast("Rescheduled", "success");
      fetchItems();
    } catch {
      toast("Reschedule failed", "error");
    }
    setDragItem(null);
  };

  // Quick reschedule
  const handleQuickEdit = async () => {
    if (!editModal.item || !editModal.date) return;
    try {
      await api.rescheduleItem(editModal.item.id, { publish_date: new Date(editModal.date).toISOString() });
      toast("Schedule updated", "success");
      setEditModal({ open: false, item: null, date: "" });
      fetchItems();
    } catch {
      toast("Update failed", "error");
    }
  };

  // Item click — show popover
  const handleItemClick = (item: ContentItem, rect: DOMRect) => {
    setPopover({ item, rect });
  };

  // Cell/slot click — open create modal
  const handleCellClick = (date: Date) => {
    setCreateModal({ open: true, date });
  };

  return (
    <div className="animate-fadeIn">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Calendar
          </h1>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-200 font-medium"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher */}
          <div className="flex rounded-xl border border-zinc-800/60 overflow-hidden glass-panel">
            {VIEW_CONFIG.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 ${view === id
                    ? "bg-gradient-to-r from-indigo-600/30 to-cyan-600/20 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-zinc-300 min-w-[180px] text-center">{getTitle()}</span>
            <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* New Item */}
          <button
            onClick={() => setCreateModal({ open: true, date: currentDate })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex gap-5">
        {/* Sidebar */}
        <CalendarSidebar
          currentDate={currentDate}
          onDateSelect={(date) => {
            setCurrentDate(date);
            if (view === "month" || view === "agenda") {
              // stay in current view
            }
          }}
          items={items}
        />

        {/* Calendar View */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <CalendarSkeleton view={view} />
          ) : (
            <>
              {view === "month" && (
                <CalendarMonthGrid
                  currentDate={currentDate}
                  items={items}
                  dragItem={dragItem}
                  onDragStart={setDragItem}
                  onDragEnd={() => setDragItem(null)}
                  onDrop={handleDrop}
                  onItemClick={handleItemClick}
                  onCellClick={handleCellClick}
                />
              )}
              {view === "week" && (
                <CalendarWeekGrid
                  currentDate={currentDate}
                  items={items}
                  dragItem={dragItem}
                  onDragStart={setDragItem}
                  onDragEnd={() => setDragItem(null)}
                  onDrop={handleDrop}
                  onItemClick={handleItemClick}
                  onCellClick={handleCellClick}
                />
              )}
              {view === "day" && (
                <CalendarDayView
                  currentDate={currentDate}
                  items={items}
                  onItemClick={handleItemClick}
                  onSlotClick={handleCellClick}
                />
              )}
              {view === "agenda" && (
                <CalendarAgendaView
                  currentDate={currentDate}
                  items={items}
                  onItemClick={handleItemClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Event Popover ── */}
      {popover && (
        <CalendarEventPopover
          item={popover.item}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onReschedule={(item) => {
            setPopover(null);
            setEditModal({ open: true, item, date: item.publish_date || item.due_date || "" });
          }}
        />
      )}

      {/* ── Reschedule Modal ── */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, item: null, date: "" })}>
        <DialogContent>
          <DialogClose onClick={() => setEditModal({ open: false, item: null, date: "" })} />
          <DialogHeader>
            <DialogTitle>Reschedule: {editModal.item?.brand}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">New Date/Time</label>
              <input
                type="datetime-local"
                value={editModal.date ? editModal.date.slice(0, 16) : ""}
                onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({ open: false, item: null, date: "" })} className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handleQuickEdit} className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-medium hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20">Save</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Item Modal ── */}
      <ItemFormModal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false, date: null })}
        onSaved={fetchItems}
      />
    </div>
  );
}

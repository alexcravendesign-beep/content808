import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, ContentItem } from "@/api/client";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, parseISO, startOfDay
} from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

const STATUS_BG: Record<string, string> = {
  idea: "bg-indigo-500",
  draft: "bg-violet-500",
  review: "bg-amber-500",
  approved: "bg-emerald-500",
  blocked: "bg-red-500",
  scheduled: "bg-blue-500",
  published: "bg-cyan-500",
};

type ViewMode = "month" | "week";

export function CalendarPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [dragItem, setDragItem] = useState<ContentItem | null>(null);
  const [editModal, setEditModal] = useState<{ open: boolean; item: ContentItem | null; date: string }>({ open: false, item: null, date: "" });

  const fetchItems = useCallback(async () => {
    try {
      let start: Date, end: Date;
      if (view === "month") {
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      } else {
        start = startOfWeek(currentDate, { weekStartsOn: 0 });
        end = endOfWeek(currentDate, { weekStartsOn: 0 });
      }
      const data = await api.getCalendar({ start: start.toISOString(), end: end.toISOString() });
      setItems(data.items);
    } catch {
      toast("Failed to load calendar", "error");
    }
  }, [currentDate, view, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const navigate_date = (dir: number) => {
    setCurrentDate(view === "month" ? (dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1)) : (dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)));
  };

  const getItemsForDate = (date: Date) =>
    items.filter((item) => {
      const d = item.publish_date || item.due_date;
      return d && isSameDay(parseISO(d), date);
    });

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

  const renderMonthGrid = () => {
    const monthStart = startOfMonth(currentDate);
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
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-zinc-900/60">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-zinc-500 text-center border-b border-zinc-800">{d}</div>
          ))}
        </div>
        {rows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const dayItems = getItemsForDate(day);
              const isToday = isSameDay(day, new Date());
              const inMonth = isSameMonth(day, currentDate);
              return (
                <div
                  key={di}
                  className={`min-h-24 border-b border-r border-zinc-800 p-1 transition-colors ${inMonth ? "" : "opacity-40"} ${dragItem ? "hover:bg-zinc-800/60" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => handleDrop(day)}
                >
                  <div className={`text-xs font-medium mb-1 px-1 ${isToday ? "text-indigo-400" : "text-zinc-500"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDragItem(item)}
                        onDragEnd={() => setDragItem(null)}
                        onClick={() => navigate(`/item/${item.id}`)}
                        onContextMenu={(e) => { e.preventDefault(); setEditModal({ open: true, item, date: item.publish_date || item.due_date || "" }); }}
                        className={`${STATUS_BG[item.status] || "bg-zinc-600"} text-white text-[10px] px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity`}
                      >
                        {item.brand}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[10px] text-zinc-500 px-1">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekGrid = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayItems = getItemsForDate(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={i}
              className={`rounded-lg border border-zinc-800 min-h-48 ${dragItem ? "hover:bg-zinc-800/60" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(day)}
            >
              <div className={`px-3 py-2 border-b border-zinc-800 ${isToday ? "bg-indigo-500/10" : ""}`}>
                <div className="text-xs text-zinc-500">{format(day, "EEE")}</div>
                <div className={`text-lg font-semibold ${isToday ? "text-indigo-400" : "text-zinc-300"}`}>{format(day, "d")}</div>
              </div>
              <div className="p-2 space-y-1">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItem(item)}
                    onDragEnd={() => setDragItem(null)}
                    onClick={() => navigate(`/item/${item.id}`)}
                    onContextMenu={(e) => { e.preventDefault(); setEditModal({ open: true, item, date: item.publish_date || item.due_date || "" }); }}
                    className={`${STATUS_BG[item.status] || "bg-zinc-600"} text-white text-xs px-2 py-1.5 rounded cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity`}
                  >
                    <div className="font-medium truncate">{item.brand}</div>
                    {item.platform && <div className="opacity-70 text-[10px]">{item.platform}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-zinc-800 overflow-hidden">
            <button onClick={() => setView("month")} className={`px-3 py-1.5 text-xs font-medium ${view === "month" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Month</button>
            <button onClick={() => setView("week")} className={`px-3 py-1.5 text-xs font-medium ${view === "week" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Week</button>
          </div>
          <button onClick={() => navigate_date(-1)} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium min-w-32 text-center">{view === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}</span>
          <button onClick={() => navigate_date(1)} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Today</button>
        </div>
      </div>

      {view === "month" ? renderMonthGrid() : renderWeekGrid()}

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
                className="w-full h-9 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({ open: false, item: null, date: "" })} className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={handleQuickEdit} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Save</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

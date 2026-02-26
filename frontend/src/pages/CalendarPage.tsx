import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ContentItem } from "@/api/client";
import { useToast } from "@/components/ui/toast";
import { ItemFormModal } from "@/components/ItemFormModal";
import { Plus, ChevronDown, RefreshCw, Image, Sparkles, Layers } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfDay
} from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Calendar sub-components
// CalendarSidebar removed — replaced by inline calendar picker in filter bar
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/calendar/CalendarWeekGrid";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { CalendarEventPopover } from "@/components/calendar/CalendarEventPopover";
import { CalendarFilterBar } from "@/components/calendar/CalendarFilterBar";
import { CalendarSkeleton } from "@/components/calendar/CalendarSkeleton";

type ViewMode = "month" | "week" | "day" | "agenda";

const ACTION_ITEMS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "sync-assets", label: "Sync Assets", icon: RefreshCw },
  { id: "generate-infographic", label: "Generate Infographic", icon: Image },
  { id: "generate-gen-hero", label: "Generate Gen Hero", icon: Sparkles },
  { id: "gen-both", label: "Gen Both", icon: Layers },
];

function ActionsDropdown({ onAction }: { onAction: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-all duration-200"
      >
        Actions
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 py-1 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] shadow-xl shadow-black/20 z-50 animate-fadeIn">
          {ACTION_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                onAction(id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseMonthParam(v: string | null): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function CalendarPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const initialDate = parseMonthParam(searchParams.get('month')) || new Date();
  const initialView = (searchParams.get('view') as ViewMode) || 'month';
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [view, setView] = useState<ViewMode>(["month", "week", "day", "agenda"].includes(initialView) ? initialView : "month");
  // sidebar removed — calendar picker now in filter bar
  const [dragItem, setDragItem] = useState<ContentItem | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [batchState, setBatchState] = useState<{ running: boolean; mode?: 'sync'|'infographic'|'hero'|'both'; total?: number; processed?: number; startedAt?: number }>({ running: false });
  const [generatingItemId, setGeneratingItemId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({ brand: "", platform: "", status: "", assignee: "" });

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

      const params: Record<string, string> = {
        start: start.toISOString(),
        end: end.toISOString(),
      };
      if (filters.brand) params.brand = filters.brand;
      if (filters.platform) params.platform = filters.platform;
      if (filters.status) params.status = filters.status;
      if (filters.assignee) params.assignee = filters.assignee;

      const data = await api.getCalendar(params);
      setItems(data.items);
    } catch {
      toast("Failed to load calendar", "error");
    } finally {
      setLoading(false);
    }
  }, [currentDate, view, filters, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Keep URL shareable: /calendar?month=YYYY-MM&view=...
  useEffect(() => {
    const month = format(currentDate, 'yyyy-MM');
    const next = new URLSearchParams(searchParams);
    next.set('month', month);
    next.set('view', view);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [currentDate, view]);

  // Handle back/forward URL changes
  useEffect(() => {
    const m = parseMonthParam(searchParams.get('month'));
    const v = searchParams.get('view');
    if (m && format(m, 'yyyy-MM') !== format(currentDate, 'yyyy-MM')) setCurrentDate(m);
    if (v && ["month", "week", "day", "agenda"].includes(v) && v !== view) setView(v as ViewMode);
  }, [searchParams]);

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

  // ── Optimistic drag and drop ──
  const handleDrop = async (date: Date) => {
    if (!dragItem) return;
    const newDate = startOfDay(date).toISOString();
    const originalItems = [...items];
    const movedItem = dragItem;

    // Optimistic update — move card instantly
    setItems((prev) =>
      prev.map((item) =>
        item.id === movedItem.id
          ? { ...item, publish_date: newDate }
          : item
      )
    );
    setSavingItemId(movedItem.id);
    setDragItem(null);

    try {
      await api.rescheduleItem(movedItem.id, { publish_date: newDate });
      toast("Rescheduled ✓", "success");
    } catch {
      // Revert on failure
      setItems(originalItems);
      toast("Reschedule failed — reverted", "error");
    } finally {
      setSavingItemId(null);
    }
  };

  // Quick reschedule
  const handleQuickEdit = async () => {
    if (!editModal.item || !editModal.date) return;
    const originalItems = [...items];
    const newDate = new Date(editModal.date).toISOString();

    // Optimistic
    setItems((prev) =>
      prev.map((item) =>
        item.id === editModal.item!.id ? { ...item, publish_date: newDate } : item
      )
    );
    setSavingItemId(editModal.item.id);
    setEditModal({ open: false, item: null, date: "" });

    try {
      await api.rescheduleItem(editModal.item!.id, { publish_date: newDate });
      toast("Schedule updated ✓", "success");
    } catch {
      setItems(originalItems);
      toast("Update failed — reverted", "error");
    } finally {
      setSavingItemId(null);
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

  const handleSyncVisibleAssets = async () => {
    try {
      const ids = items.map((i) => i.id);
      if (!ids.length) {
        toast('No visible items to sync', 'error');
        return;
      }
      if (batchState.running) {
        toast('A batch job is already running', 'error');
        return;
      }
      setBatchState({ running: true, mode: 'sync', total: ids.length, processed: 0, startedAt: Date.now() });
      toast(`Sync started for ${ids.length} visible item(s)…`, 'success');
      const res = await api.syncProductAssetsBatch(ids);
      toast(`Synced assets: ${res.okCount}/${res.processed} items (${res.createdTotal} outputs)`, 'success');
      await fetchItems();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Batch asset sync failed', 'error');
    } finally {
      setBatchState({ running: false });
    }
  };

  const handleGenerateVisible = async (mode: 'infographic'|'hero'|'both') => {
    try {
      const ids = items.map((i) => i.id);
      const maxBatch = 8;
      if (!ids.length) {
        toast('No visible items to generate', 'error');
        return;
      }
      if (ids.length > maxBatch) {
        toast(`Batch blocked: ${ids.length} visible items. Max is ${maxBatch}. Narrow filters/date range.`, 'error');
        return;
      }
      if (batchState.running) {
        toast('A batch job is already running', 'error');
        return;
      }
      setBatchState({ running: true, mode, total: ids.length, processed: 0, startedAt: Date.now() });
      toast(`Generate ${mode} queued for ${ids.length} visible item(s)…`, 'success');
      const queued = await api.generateBatch(ids, mode);

      let done = false;
      for (let i = 0; i < 240; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.getGenerateBatchStatus(queued.jobId);
        const p = s.progress || { processed: 0, total: ids.length, okCount: 0 };
        setBatchState((prev) => ({ running: true, mode, total: p.total || ids.length, processed: p.processed || 0, startedAt: prev.startedAt || Date.now() }));

        if (s.state === 'completed') {
          const processed = s.processed || p.processed || ids.length;
          const okCount = s.okCount || p.okCount || 0;
          const failed = processed - okCount;
          toast(`Generated ${mode}: ${okCount}/${processed}${failed ? ` (${failed} failed)` : ''}`, failed ? 'error' : 'success');
          done = true;
          break;
        }
        if (s.state === 'failed') {
          toast(`Batch ${mode} failed: ${s.error || 'unknown error'}`, 'error');
          done = true;
          break;
        }
      }

      if (!done) toast(`Batch ${mode} is still running in background`, 'error');
      await fetchItems();
    } catch (err) {
      toast(err instanceof Error ? err.message : `Batch ${mode} failed`, 'error');
    } finally {
      setBatchState({ running: false });
    }
  };

  const handleGenerateFromPopover = async (mode: 'infographic' | 'hero' | 'both', item: ContentItem) => {
    try {
      if (generatingItemId) {
        toast('Another generation is already running', 'error');
        return;
      }
      setGeneratingItemId(item.id);

      if (mode === 'infographic') {
        await api.generateInfographic(item.id);
      } else if (mode === 'hero') {
        await api.generateHero(item.id);
      } else {
        await api.generateBoth(item.id);
      }

      toast(`Generate ${mode} started for ${item.product_title || item.brand}`, 'success');
      await fetchItems();
      setPopover(null);
      navigate(`/item/${item.id}?tab=outputs`);
    } catch (err) {
      toast(err instanceof Error ? err.message : `Generate ${mode} failed`, 'error');
    } finally {
      setGeneratingItemId(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
            Calendar
          </h1>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] hover:text-[hsl(var(--th-text))] transition-all duration-200 font-medium"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Actions Dropdown */}
          <ActionsDropdown onAction={(id) => {
            if (id === 'sync-assets') handleSyncVisibleAssets();
            else if (id === 'generate-infographic') handleGenerateVisible('infographic');
            else if (id === 'generate-gen-hero') handleGenerateVisible('hero');
            else if (id === 'gen-both') handleGenerateVisible('both');
          }} />

          {/* New Item */}
          <button
            onClick={() => setCreateModal({ open: true, date: currentDate })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-[11px] font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <CalendarFilterBar
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        dateTitle={getTitle()}
        onNavigateDate={navigateDate}
        currentDate={currentDate}
        onDateSelect={(date) => setCurrentDate(date)}
      />

      {/* ── Main Content ── */}
      <div className="flex-1">
        {/* Calendar View */}
        <div className="min-w-0">
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

          {/* Saving indicator (subtle) */}
          {savingItemId && (
            <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] text-xs text-[hsl(var(--th-text-secondary))] shadow-xl backdrop-blur-sm animate-fadeIn z-50">
              <div className="h-3 w-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              Saving...
            </div>
          )}

          {batchState.running && (
            <div className="fixed bottom-20 right-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] text-xs text-[hsl(var(--th-text-secondary))] shadow-xl backdrop-blur-sm animate-fadeIn z-50">
              <div className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              Processing {batchState.mode} {batchState.processed || 0}/{batchState.total || 0}…
            </div>
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
          onGenerateInfographic={(item) => handleGenerateFromPopover('infographic', item)}
          onGenerateHero={(item) => handleGenerateFromPopover('hero', item)}
          onGenerateBoth={(item) => handleGenerateFromPopover('both', item)}
          isGenerating={generatingItemId === popover.item.id}
        />
      )}

      {/* ── Reschedule Modal ── */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, item: null, date: "" })}>
        <DialogContent>
          <DialogClose onClick={() => setEditModal({ open: false, item: null, date: "" })} />
          <DialogHeader>
            <DialogTitle>Reschedule: {editModal.item?.product_title || editModal.item?.brand}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">New Date/Time</label>
              <input
                type="datetime-local"
                value={editModal.date ? editModal.date.slice(0, 16) : ""}
                onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({ open: false, item: null, date: "" })} className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors">Cancel</button>
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

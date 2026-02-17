import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { api, ContentItem } from "@/api/client";
import { KpiStrip } from "@/components/KpiStrip";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { ItemFormModal } from "@/components/ItemFormModal";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";
import { KanbanLane } from "@/components/KanbanLane";

const STATUSES = ["idea", "draft", "review", "approved", "blocked", "scheduled", "published"] as const;

const STATUS_COLORS: Record<string, string> = {
  idea: "border-indigo-500/40",
  draft: "border-violet-500/40",
  review: "border-amber-500/40",
  approved: "border-emerald-500/40",
  blocked: "border-red-500/40",
  scheduled: "border-blue-500/40",
  published: "border-cyan-500/40",
};

const STATUS_BG: Record<string, string> = {
  idea: "bg-indigo-500/10",
  draft: "bg-violet-500/10",
  review: "bg-amber-500/10",
  approved: "bg-emerald-500/10",
  blocked: "bg-red-500/10",
  scheduled: "bg-blue-500/10",
  published: "bg-cyan-500/10",
};

export function KanbanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [filters, setFilters] = useState({ status: "", platform: "", assignee: "", search: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchItems = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filters.status) params.status = filters.status;
      if (filters.platform) params.platform = filters.platform;
      if (filters.assignee) params.assignee = filters.assignee;
      if (filters.search) params.search = filters.search;
      const data = await api.getItems(params);
      setItems(data.items);
    } catch {
      toast("Failed to load items", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === newStatus) return;

    try {
      await api.transitionItem(itemId, newStatus);
      toast(`Moved to ${newStatus}`, "success");
      fetchItems();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Transition failed", "error");
    }
  };

  const grouped = STATUSES.reduce((acc, status) => {
    acc[status] = items.filter((i) => i.status === status);
    return acc;
  }, {} as Record<string, ContentItem[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Content Board</h1>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Item
        </button>
      </div>

      <KpiStrip />
      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUSES.map((status) => (
              <KanbanLane
                key={status}
                status={status}
                items={grouped[status] || []}
                borderColor={STATUS_COLORS[status]}
                bgColor={STATUS_BG[status]}
                onItemClick={(item) => navigate(`/item/${item.id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeItem ? <ItemCard item={activeItem} compact /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ItemFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={fetchItems} />
    </div>
  );
}

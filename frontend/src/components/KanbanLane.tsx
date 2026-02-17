import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { ContentItem } from "@/api/client";
import { ItemCard } from "@/components/ItemCard";

interface KanbanLaneProps {
  status: string;
  items: ContentItem[];
  borderColor: string;
  bgColor: string;
  onItemClick: (item: ContentItem) => void;
}

export function KanbanLane({ status, items, borderColor, bgColor, onItemClick }: KanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 rounded-lg border-t-2 ${borderColor} ${isOver ? "bg-zinc-800/60" : "bg-zinc-900/40"} transition-colors`}
    >
      <div className={`flex items-center justify-between px-3 py-2.5 ${bgColor} rounded-t-lg`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{status}</span>
        <span className="text-xs font-medium text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{items.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-24">
        {items.map((item) => (
          <DraggableItem key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </div>
  );
}

function DraggableItem({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ItemCard item={item} onClick={onClick} compact />
    </div>
  );
}

import { ContentItem } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_DOT: Record<string, string> = {
  idea: "bg-indigo-400",
  draft: "bg-violet-400",
  review: "bg-amber-400",
  approved: "bg-emerald-400",
  blocked: "bg-red-400",
  scheduled: "bg-blue-400",
  published: "bg-cyan-400",
};

interface ItemCardProps {
  item: ContentItem;
  onClick?: () => void;
  compact?: boolean;
}

export function ItemCard({ item, onClick, compact }: ItemCardProps) {
  return (
    <div
      onClick={onClick}
      className="group bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-600 hover:bg-zinc-900 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[item.status] || "bg-zinc-500"}`} />
          <span className="text-sm font-medium text-zinc-100 truncate">{item.brand}</span>
        </div>
        {item.platform && (
          <Badge variant="secondary" className="text-[10px] uppercase shrink-0">{item.platform}</Badge>
        )}
      </div>

      {!compact && item.campaign_goal && (
        <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{item.campaign_goal}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        {item.assignee && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {item.assignee}
          </span>
        )}
        {item.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(item.due_date), "MMM d")}
          </span>
        )}
        {item.product_url && (
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}

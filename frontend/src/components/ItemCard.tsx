import { ContentItem } from "@/api/client";
import { campaignGoalLabel } from "@/lib/formatHelpers";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { STATUS_DOT, STATUS_GLOW } from "@/lib/statusConfig";
import { ProductThumbnail } from "@/components/calendar/ProductThumbnail";

interface ItemCardProps {
  item: ContentItem;
  onClick?: () => void;
  compact?: boolean;
}

export function ItemCard({ item, onClick, compact }: ItemCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-xl p-3 cursor-pointer hover:border-[hsl(var(--th-text-muted)/0.6)] hover:bg-[hsl(var(--th-surface-hover))] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${STATUS_GLOW[item.status] || ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <ProductThumbnail item={item} size="sm" />
          <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[item.status] || "bg-zinc-500"} ring-2 ring-[hsl(var(--th-surface))]`} />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[hsl(var(--th-text))] truncate block group-hover:text-[hsl(var(--th-text))] transition-colors">{item.product_title || item.brand}</span>
            {item.product_title && item.brand !== item.product_title && (
              <span className="text-[11px] text-[hsl(var(--th-text-muted))] truncate block">{item.brand}</span>
            )}
          </div>
        </div>
        {item.platform && (
          <Badge variant="secondary" className="text-[10px] uppercase shrink-0">{item.platform}</Badge>
        )}
      </div>

      {!compact && item.campaign_goal && (
        <p className="text-xs text-[hsl(var(--th-text-secondary))] mb-2 line-clamp-2 group-hover:text-[hsl(var(--th-text))] transition-colors">{campaignGoalLabel(item.campaign_goal)}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-[hsl(var(--th-text-muted))] flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.has_hero ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-zinc-700/40 text-zinc-400'}`}>
          H {item.has_hero ? '✓' : '·'}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.has_infographic ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700/40 text-zinc-400'}`}>
          I {item.has_infographic ? '✓' : '·'}
        </span>
        {item.creative_done && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/20 text-cyan-300">DONE</span>
        )}
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

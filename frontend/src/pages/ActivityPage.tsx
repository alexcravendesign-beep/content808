import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { api, AuditEntry } from "@/api/client";
import { format } from "date-fns";
import { Activity, FileText, Edit, ChevronRight, Zap, Trash2, MessageSquare, Settings } from "lucide-react";
import { ActivitySkeleton } from "@/components/Skeletons";

const ACTION_ICONS: Record<string, React.ElementType> = {
  create: FileText, update: Edit, transition: ChevronRight,
  approve: Zap, block: Trash2, comment: MessageSquare, plugin_update: Settings,
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-400 bg-emerald-500/10",
  update: "text-blue-400 bg-blue-500/10",
  transition: "text-violet-400 bg-violet-500/10",
  approve: "text-emerald-400 bg-emerald-500/10",
  block: "text-red-400 bg-red-500/10",
  comment: "text-amber-400 bg-amber-500/10",
};

export function ActivityPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActivity(100)
      .then((data) => setEntries(data.entries || []))
      .catch(() => toast("Failed to load activity", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="max-w-3xl mx-auto"><ActivitySkeleton /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">Full audit trail of all content operations</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">
          <Activity className="h-12 w-12 mb-3 opacity-30" />
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const Icon = ACTION_ICONS[entry.action] || Activity;
            const color = ACTION_COLORS[entry.action] || "text-[hsl(var(--th-text-secondary))] bg-[hsl(var(--th-input))]";
            const details = entry.details as Record<string, unknown>;

            return (
              <div key={entry.id} className="flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] transition-colors">
                <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[hsl(var(--th-text))]">{entry.actor}</span>
                    <span className="text-sm text-[hsl(var(--th-text-secondary))]">{entry.action}</span>
                    <span className="text-xs text-[hsl(var(--th-text-muted))]">{entry.entity_type}</span>
                    {details.from && details.to ? (
                      <span className="text-xs text-[hsl(var(--th-text-muted))]">
                        {String(details.from)} → {String(details.to)}
                      </span>
                    ) : null}
                    {details.reason ? (
                      <span className="text-xs text-zinc-500 italic">"{String(details.reason)}"</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[hsl(var(--th-text-muted))]">
                      {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--th-text-muted))]">{entry.actor_role}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

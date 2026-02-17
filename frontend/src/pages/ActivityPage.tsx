import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { AuditEntry } from "@/api/client";
import { format } from "date-fns";
import { Activity, FileText, Edit, ChevronRight, Zap, Trash2, MessageSquare, Settings } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
    fetch(`${API_URL}/api/v1/content-hub/audit?limit=100`, {
      headers: {
        "x-user-id": "staff-user-1",
        "x-user-name": "Staff User",
        "x-user-role": "admin",
      },
    })
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => toast("Failed to load activity", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <p className="text-sm text-zinc-500 mt-1">Full audit trail of all content operations</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
          <Activity className="h-12 w-12 mb-3 opacity-30" />
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const Icon = ACTION_ICONS[entry.action] || Activity;
            const color = ACTION_COLORS[entry.action] || "text-zinc-400 bg-zinc-800";
            const details = entry.details as Record<string, unknown>;

            return (
              <div key={entry.id} className="flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-zinc-900/60 transition-colors">
                <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200">{entry.actor}</span>
                    <span className="text-sm text-zinc-400">{entry.action}</span>
                    <span className="text-xs text-zinc-600">{entry.entity_type}</span>
                    {details.from && details.to ? (
                      <span className="text-xs text-zinc-500">
                        {String(details.from)} → {String(details.to)}
                      </span>
                    ) : null}
                    {details.reason ? (
                      <span className="text-xs text-zinc-500 italic">"{String(details.reason)}"</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-600">
                      {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                    </span>
                    <span className="text-[11px] text-zinc-700">{entry.actor_role}</span>
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

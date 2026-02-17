import { useEffect, useState } from "react";
import { api, Stats } from "@/api/client";
import { productApi, ProductStats } from "@/api/productApi";
import { FileText, Clock, CalendarCheck, AlertTriangle, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-indigo-500/20 text-indigo-400",
  draft: "bg-violet-500/20 text-violet-400",
  review: "bg-amber-500/20 text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  blocked: "bg-red-500/20 text-red-400",
  scheduled: "bg-blue-500/20 text-blue-400",
  published: "bg-cyan-500/20 text-cyan-400",
};

export function KpiStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    productApi.getStats().then(setProductStats).catch(console.error);
    const interval = setInterval(() => {
      api.getStats().then(setStats).catch(console.error);
      productApi.getStats().then(setProductStats).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <KpiCard icon={FileText} label="Total Items" value={stats.total} color="bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))]" />
      {productStats && (
        <KpiCard icon={Package} label="Products" value={productStats.total} color="bg-violet-500/10 text-violet-400" tooltip={`${productStats.with_image} with images · ${productStats.dna_ready} DNA ready`} />
      )}
      <KpiCard icon={Clock} label="Due Soon" value={stats.due_soon} color="bg-amber-500/10 text-amber-400" />
      <KpiCard icon={CalendarCheck} label="Scheduled Today" value={stats.scheduled_today} color="bg-blue-500/10 text-blue-400" />
      <KpiCard icon={AlertTriangle} label="Blocked" value={stats.by_status.blocked || 0} color="bg-red-500/10 text-red-400" />
      {Object.entries(stats.by_status).map(([status, count]) => (
        <div key={status} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_COLORS[status] || "bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))]"}`}>
          <span className="capitalize">{status}</span>
          <span className="font-bold">{count}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, tooltip }: { icon: React.ElementType; label: string; value: number; color: string; tooltip?: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${color}`} title={tooltip}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="font-bold ml-1">{value}</span>
    </div>
  );
}


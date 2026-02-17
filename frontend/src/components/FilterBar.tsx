import { Search, X } from "lucide-react";

interface Filters {
  status: string;
  platform: string;
  assignee: string;
  search: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const STATUSES = ["", "idea", "draft", "review", "approved", "blocked", "scheduled", "published"];
const PLATFORMS = ["", "instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin", "email"];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search items..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className="h-9 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        <option value="">All Statuses</option>
        {STATUSES.filter(Boolean).map((s) => (
          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>

      <select
        value={filters.platform}
        onChange={(e) => set("platform", e.target.value)}
        className="h-9 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        <option value="">All Platforms</option>
        {PLATFORMS.filter(Boolean).map((p) => (
          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Assignee..."
        value={filters.assignee}
        onChange={(e) => set("assignee", e.target.value)}
        className="h-9 px-3 w-36 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      />

      {hasFilters && (
        <button
          onClick={() => onChange({ status: "", platform: "", assignee: "", search: "" })}
          className="h-9 px-3 rounded-md bg-zinc-800 text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Calendar, CheckSquare, Settings, Activity,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

const navItems = [
  { to: "/", label: "Kanban", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-screen z-50 flex flex-col glass-panel sidebar-transition ${collapsed ? "w-16" : "w-60"
          }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.04] shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 flex items-center justify-center text-sm font-black text-white shrink-0 animate-float">
            C
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight animate-fadeIn whitespace-nowrap">
              Content Hub
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const linkContent = (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                  } ${active
                    ? "bg-gradient-to-r from-indigo-500/15 to-cyan-500/10 text-white shadow-sm shadow-indigo-500/10"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                  }`}
              >
                <div className="relative shrink-0">
                  <item.icon className={`h-[18px] w-[18px] transition-colors ${active ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                  {active && (
                    <span className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-indigo-500" />
                  )}
                </div>
                {!collapsed && (
                  <span className="animate-fadeIn whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={item.to} content={item.label} side="right">
                {linkContent}
              </Tooltip>
            ) : (
              <div key={item.to}>{linkContent}</div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.04] p-3 shrink-0">
          {/* User avatar */}
          <div className={`flex items-center gap-3 mb-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300 ring-2 ring-zinc-700/50 shrink-0">
              SU
            </div>
            {!collapsed && (
              <div className="animate-fadeIn min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">Staff User</p>
                <p className="text-[10px] text-zinc-500">Admin</p>
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-2 rounded-md py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors ${collapsed ? "justify-center px-0" : "px-2"
              }`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="animate-fadeIn">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"
          }`}
      >
        <div className="mx-auto max-w-screen-2xl p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

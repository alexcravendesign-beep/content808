import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, CheckSquare, Settings, Activity } from "lucide-react";

const navItems = [
  { to: "/", label: "Kanban", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center px-4 gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-base tracking-tight">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-black text-white">C</div>
            <span>Content Hub</span>
          </Link>

          <div className="flex items-center gap-1 ml-6">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300">
                SU
              </div>
              <span className="hidden sm:inline">Staff User</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-screen-2xl p-4">
        {children}
      </main>
    </div>
  );
}

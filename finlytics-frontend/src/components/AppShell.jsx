import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "◧" },
  { to: "/upload", label: "Upload", icon: "↑" },
  { to: "/insights", label: "Insights", icon: "◈" },
  { to: "/admin", label: "Admin", icon: "⚙" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-ink-800 text-white border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-[56px]">
          <span className="font-display text-xl tracking-tight">Finlytics</span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/15 transition-colors"
            aria-label="Menu"
          >
            <span className="relative w-4 h-3 block">
              <span className={`absolute left-0 w-full h-0.5 bg-white rounded-full transition-all ${mobileOpen ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-1.5 w-full h-0.5 bg-white rounded-full transition-all ${mobileOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`absolute left-0 w-full h-0.5 bg-white rounded-full transition-all ${mobileOpen ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/10 bg-ink-800 animate-fade-in">
            <nav className="px-3 py-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive ? "bg-white text-ink-800" : "text-white/70 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  <span className="h-7 w-7 grid place-items-center rounded-lg bg-white/10 text-xs">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/50 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="text-sm text-white/70 hover:text-white px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 transition-colors shrink-0">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-ink-800 text-white flex-col relative">
        <div className="ledger-spine absolute right-0 top-0 bottom-0 w-px" />
        <div className="px-6 pt-8 pb-10">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-tight">Finlytics</span>
          </div>
          <p className="text-xs text-white/40 mt-1">Personal finance, understood.</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-6 pt-4 border-t border-white/10">
          <div className="px-2 mb-3">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-[72px] lg:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border">
        <div className="grid grid-cols-4 h-[64px]">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? "text-ink-800 bg-paper" : "text-muted hover:text-ink"
                }`
              }
            >
              <span className="text-[16px] leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

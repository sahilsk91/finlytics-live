import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload" },
  { to: "/insights", label: "Insights" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-64 shrink-0 bg-ink-800 text-white flex flex-col relative">
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
                `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-6 pt-4 border-t border-white/10">
          <div className="px-2 mb-3">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Card, PageHeader } from "../components/Card";
import Money from "../components/Money";
import CategoryBadge from "../components/CategoryBadge";
import CategoryPieChart from "../components/CategoryPieChart";
import SpendingTrendChart from "../components/SpendingTrendChart";
import ForecastCard from "../components/ForecastCard";
import FlaggedTransactions from "../components/FlaggedTransactions";

const CATEGORIES = [
  "Food", "Travel", "Bills", "Shopping",
  "Entertainment", "Health", "Other", "Uncategorized",
];

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listTransactions(user.id),
      api.getForecast(user.id).catch(() => null),
    ])
      .then(([tx, fc]) => {
        if (cancelled) return;
        setTransactions(tx);
        setForecast(fc);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  const stats = useMemo(() => {
    const totalPaise = transactions.reduce((sum, t) => sum + t.amount, 0);
    const flagged = transactions.filter((t) => t.is_anomaly === 1);
    const uncategorized = transactions.filter((t) => t.category === "Uncategorized").length;
    return { totalPaise, count: transactions.length, flagged, uncategorized };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const totals = {};
    for (const t of transactions) {
      if (t.amount <= 0) continue; // spend only, exclude credits/refunds
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
    return Object.entries(totals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const trendHistory = useMemo(() => {
    const totals = {};
    for (const t of transactions) {
      if (t.amount <= 0) continue;
      const month = t.date.slice(0, 7);
      totals[month] = (totals[month] || 0) + t.amount;
    }
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (flaggedOnly && t.is_anomaly !== 1) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, categoryFilter, search, flaggedOnly]);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user?.name?.split(" ")[0] || ""}`}
        description="Everything you've tracked, in one place."
      />

      <div className="grid grid-cols-3 gap-5 mb-6">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Total tracked</p>
          <Money paise={stats.totalPaise} size="2xl" />
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Transactions</p>
          <p className="font-mono tabular text-4xl text-ink">{stats.count}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Flagged as unusual</p>
          <p className="font-mono tabular text-4xl text-amber">{stats.flagged.length}</p>
        </Card>
      </div>

      {!loading && <FlaggedTransactions transactions={stats.flagged} />}

      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-5 gap-5 mb-6">
          <Card className="col-span-2">
            <h2 className="font-display text-lg text-ink mb-1">By category</h2>
            <p className="text-sm text-muted mb-2">Spending only, credits excluded.</p>
            <CategoryPieChart data={categoryBreakdown} />
            <div className="space-y-1.5 mt-2">
              {categoryBreakdown.slice(0, 4).map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <CategoryBadge category={c.category} />
                  <Money paise={c.amount} size="sm" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-3">
            <h2 className="font-display text-lg text-ink mb-1">Spending trend</h2>
            <p className="text-sm text-muted mb-2">
              Monthly totals{forecast?.available ? ", with next month's forecast" : ""}.
            </p>
            <SpendingTrendChart history={trendHistory} forecast={forecast?.available ? forecast.forecast : null} />
          </Card>
        </div>
      )}

      {!loading && (
        <Card className="mb-6">
          <h2 className="font-display text-lg text-ink mb-1">Next month's forecast</h2>
          <ForecastCard forecast={forecast} />
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-ink">Transactions</h2>
            {stats.uncategorized > 0 && (
              <span className="text-xs text-muted">{stats.uncategorized} awaiting categorization</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] rounded-lg border border-border px-3.5 py-2 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-border px-3.5 py-2 text-sm bg-surface focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="rounded border-border text-ledger-600 focus:ring-ledger-600"
              />
              Flagged only
            </label>
          </div>
        </div>

        {loading && <div className="px-6 py-10 text-center text-muted text-sm">Loading…</div>}

        {error && (
          <div className="px-6 py-10 text-center text-danger text-sm">Couldn't reach the backend: {error}</div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-xl text-ink mb-2">No transactions yet</p>
            <p className="text-muted text-sm">Upload a bank statement or add a transaction to get started.</p>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-muted text-sm">No transactions match these filters.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-paper/60">
                  <td className="px-6 py-3.5 text-muted whitespace-nowrap">{t.date}</td>
                  <td className="px-6 py-3.5 text-ink">
                    {t.description}
                    {t.is_anomaly === 1 && (
                      <span className="ml-2 text-amber text-xs font-medium">● flagged</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5"><CategoryBadge category={t.category} /></td>
                  <td className="px-6 py-3.5 text-right">
                    <Money paise={t.amount} sign={t.is_anomaly === 1 ? "flag" : "auto"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

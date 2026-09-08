import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Card, PageHeader } from "../components/Card";
import Money from "../components/Money";
import { CATEGORY_COLORS } from "../components/CategoryBadge";

export default function Insights() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.listTransactions(user.id).then(setTransactions).finally(() => setLoading(false));
  }, [user]);

  // Spend only - credits/refunds/salary (negative amount) are income, not
  // "spending in a category", so they're excluded here. Without this a
  // category that happens to catch a salary credit (e.g. "Other") would
  // show a large negative total and throw off every bar's width.
  const spendTransactions = useMemo(
    () => transactions.filter((t) => t.amount > 0),
    [transactions]
  );

  const creditTotal = useMemo(
    () => transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const breakdown = useMemo(() => {
    const totals = {};
    for (const t of spendTransactions) {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
      .map(([category, amount]) => ({ category, amount, pct: amount / grandTotal }))
      .sort((a, b) => b.amount - a.amount);
  }, [spendTransactions]);

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Insights"
        title="Where it's going"
        description="Category breakdown of your spending. Credits and refunds are shown separately, not mixed into the bars below."
      />

      <Card>
        {loading && <p className="text-muted text-sm text-center py-8">Loading…</p>}

        {!loading && breakdown.length === 0 && (
          <div className="text-center py-12">
            <p className="font-display text-xl text-ink mb-2">Nothing to show yet</p>
            <p className="text-muted text-sm">Add or import some transactions first.</p>
          </div>
        )}

        {!loading && breakdown.length > 0 && (
          <div className="space-y-5">
            {breakdown.map(({ category, amount, pct }) => {
              const color = CATEGORY_COLORS[category]?.fg || "#5B5E63";
              return (
                <div key={category}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-ink">{category}</span>
                    <Money paise={amount} size="sm" />
                  </div>
                  <div className="h-2 rounded-full bg-paper overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct * 100, 2)}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!loading && creditTotal < 0 && (
        <Card className="mt-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Credits received</p>
              <p className="text-xs text-muted mt-0.5">Salary, refunds, and other money in — not counted as spending above.</p>
            </div>
            <Money paise={Math.abs(creditTotal)} size="lg" />
          </div>
        </Card>
      )}
    </div>
  );
}

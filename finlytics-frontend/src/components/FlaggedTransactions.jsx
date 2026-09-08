import Money from "./Money";
import CategoryBadge from "./CategoryBadge";

export default function FlaggedTransactions({ transactions }) {
  if (!transactions?.length) return null;

  return (
    <div className="bg-amber/5 border border-amber/25 rounded-xl2 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber" />
        <h2 className="font-display text-lg text-ink">
          {transactions.length} unusual transaction{transactions.length !== 1 ? "s" : ""} flagged
        </h2>
      </div>
      <p className="text-sm text-muted mb-4">
        These stand out from your typical spending pattern for their category — worth a second look.
      </p>
      <div className="space-y-2">
        {transactions.slice(0, 6).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CategoryBadge category={t.category} />
              <span className="text-sm text-ink truncate">{t.description}</span>
              <span className="text-xs text-muted whitespace-nowrap">{t.date}</span>
            </div>
            <Money paise={t.amount} sign="flag" size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

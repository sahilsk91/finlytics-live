export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl2 shadow-card p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-ledger-600 mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        {description && <p className="text-muted mt-2 max-w-xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

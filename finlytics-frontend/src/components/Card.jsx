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
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-ledger-600 mb-2">{eyebrow}</p>}
        <h1 className="font-display text-2xl sm:text-3xl text-ink leading-tight">{title}</h1>
        {description && <p className="text-muted mt-2 max-w-xl text-sm sm:text-base leading-6">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, PageHeader } from "../components/Card";
import Money from "../components/Money";

function Stat({ label, value, sub }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-[11px] tracking-[0.12em] uppercase font-semibold text-muted">{label}</p>
      <p className="font-mono tabular text-2xl font-medium text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.requestAdminOverview().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const openUser = async (u) => {
    setSelected(u);
    setDetail(null);
    try {
      const d = await api.requestAdminUser(u.id);
      setDetail(d);
    } catch (e) {
      setDetail({ error: e.message });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Admin"
        title="All users & their data"
        description="Every account, email, and how much they have tracked. Tap a user to see their transactions and uploads."
      />

      {loading && <p className="text-sm text-muted py-10 text-center">Loading…</p>}
      {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{error}</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-up">
            <Stat label="Total users" value={data.total_users} sub="accounts created" />
            <Stat label="Total transactions" value={data.total_transactions} sub="across all users" />
            <Stat label="Total uploads" value={data.total_uploads} sub="CSV files imported" />
          </div>

          <Card className="p-0 overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Users</h2>
              <span className="text-xs font-mono tabular text-muted border border-border rounded-full px-3 py-1 bg-paper">{data.users.length} accounts</span>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border bg-paper/50">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium text-right">Txns</th>
                    <th className="px-6 py-3 font-medium text-right">Uploads</th>
                    <th className="px-6 py-3 font-medium text-right">Total spent</th>
                    <th className="px-6 py-3 font-medium">Last txn</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} onClick={() => openUser(u)} className="border-b border-border last:border-0 hover:bg-paper/60 cursor-pointer transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-xs text-muted">#{u.id} • {u.created_at.slice(0, 10)}</p>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-ink">{u.email}</td>
                      <td className="px-6 py-3.5 text-right font-mono tabular">{u.tx_count}</td>
                      <td className="px-6 py-3.5 text-right font-mono tabular">{u.upload_count}</td>
                      <td className="px-6 py-3.5 text-right"><Money paise={u.total_spent_paise} size="sm" /></td>
                      <td className="px-6 py-3.5 text-muted text-xs">{u.last_tx_date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-3 bg-paper space-y-3">
              {data.users.map((u) => (
                <button key={u.id} onClick={() => openUser(u)} className="w-full text-left bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-[0_8px_20px_rgba(16,24,39,0.06)] hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{u.name}</p>
                      <p className="text-xs font-mono text-muted truncate">{u.email}</p>
                    </div>
                    <span className="shrink-0 text-xs font-mono tabular bg-ink-800 text-white rounded-full px-2.5 py-1">#{u.id}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-paper border border-border rounded-xl p-2">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted">Txns</p>
                      <p className="font-mono tabular font-medium text-ink">{u.tx_count}</p>
                    </div>
                    <div className="bg-paper border border-border rounded-xl p-2">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted">Uploads</p>
                      <p className="font-mono tabular font-medium text-ink">{u.upload_count}</p>
                    </div>
                    <div className="bg-paper border border-border rounded-xl p-2">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted">Spent</p>
                      <p className="font-mono tabular text-xs font-medium text-ink truncate"><Money paise={u.total_spent_paise} size="sm" /></p>
                    </div>
                  </div>
                  {u.top_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {u.top_categories.map((c) => (
                        <span key={c.category} className="text-xs bg-paper border border-border rounded-full px-2.5 py-1">{c.category} ×{c.count}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {selected && (
            <Card className="mt-6 animate-fade-up">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-lg text-ink">{selected.name}</h3>
                  <p className="text-sm font-mono text-muted">{selected.email} • #{selected.id}</p>
                </div>
                <button onClick={() => { setSelected(null); setDetail(null); }} className="h-8 w-8 grid place-items-center rounded-full bg-paper border border-border hover:bg-surface transition-colors">×</button>
              </div>
              {!detail && <p className="text-sm text-muted py-6 text-center">Loading transactions…</p>}
              {detail?.error && <p className="text-sm text-danger">{detail.error}</p>}
              {detail && !detail.error && (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Uploads ({detail.uploads.length})</p>
                    {detail.uploads.length === 0 ? <p className="text-sm text-muted">No uploads yet.</p> : (
                      <div className="space-y-2">
                        {detail.uploads.map((up) => (
                          <div key={up.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-paper border border-border rounded-xl px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{up.filename}</p>
                              <p className="text-xs font-mono text-muted truncate">{up.file_hash.slice(0, 12)}… • {up.status} • {up.uploaded_at.slice(0, 10)}</p>
                            </div>
                            <span className="text-xs font-mono tabular bg-surface border border-border rounded-full px-3 py-1 self-start sm:self-auto">{up.rows_imported}/{up.rows_in_file} rows</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Transactions — {detail.transactions.length} most recent</p>
                    {detail.transactions.length === 0 ? <p className="text-sm text-muted">No transactions.</p> : (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {detail.transactions.map((t) => (
                          <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-paper border border-border rounded-xl px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{t.description} <span className="text-xs text-muted">• {t.category}</span> {t.is_anomaly === 1 && <span className="ml-1 text-amber text-xs font-semibold">● flagged</span>}</p>
                              <p className="text-xs font-mono text-muted">{t.date}</p>
                            </div>
                            <span className="shrink-0 self-start sm:self-auto"><Money paise={t.amount} size="sm" /></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function MockPreview() {
  const rows = [
    { date: "2026-09-03", desc: "SWIGGY ORDER #8841", amt: "₹482.00", cat: "Food", flag: false },
    { date: "2026-09-02", desc: "UBER TRIP  •  BLR-42", amt: "₹247.00", cat: "Travel", flag: false },
    { date: "2026-09-02", desc: "AIRTEL POSTPAID", amt: "₹799.00", cat: "Bills", flag: false },
    { date: "2026-09-01", desc: "POS 41XXXXXXXXXX4821  AMAZON", amt: "₹3,299.00", cat: "Shopping", flag: true },
    { date: "2026-08-31", desc: "APOLLO PHARMACY", amt: "₹1,150.00", cat: "Health", flag: false },
  ];
  const cats = {
    Food: "bg-amber/10 text-amber border-amber/20",
    Travel: "bg-ledger-50 text-ledger-700 border-ledger-100",
    Bills: "bg-paper text-ink border-border",
    Shopping: "bg-danger/5 text-danger border-danger/20",
    Health: "bg-mint/20 text-ink border-mint/30",
  };
  return (
    <div className="bg-surface rounded-xl2 shadow-raised border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ledger-600" />
          <span className="text-xs font-medium tracking-wider uppercase text-muted">Live preview — your data looks like this</span>
        </div>
        <span className="text-xs font-mono tabular text-muted">5 transactions</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.desc} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-xs font-mono tabular text-muted w-[84px] shrink-0">{r.date}</span>
            <span className="flex-1 text-sm text-ink truncate flex items-center gap-2">
              {r.desc}
              {r.flag && <span className="text-[11px] font-medium text-amber border border-amber/20 bg-amber/10 rounded-full px-2 py-0.5">flagged</span>}
            </span>
            <span className={`hidden sm:inline-flex text-[11px] font-medium border rounded-full px-2 py-1 ${cats[r.cat]}`}>{r.cat}</span>
            <span className="text-sm font-mono tabular text-ink w-[92px] text-right">{r.amt}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-paper border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted">Auto-categorized • anomalies scored at import</span>
        <span className="text-xs font-mono tabular text-ink">Total <span className="font-medium">₹5,977.00</span></span>
      </div>
    </div>
  );
}

function Feature({ k, title, desc }) {
  return (
    <div className="bg-surface rounded-xl2 border border-border p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="h-7 w-7 rounded-lg bg-ink-800 text-white grid place-items-center text-xs font-mono tabular">{k}</span>
        <h3 className="font-display text-[17px] text-ink">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-muted">{desc}</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 backdrop-blur bg-paper/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-display text-[22px] tracking-tight text-ink">Finlytics</span>
            <span className="hidden sm:inline text-xs tracking-wider uppercase text-muted border border-border rounded-full px-2 py-1 bg-surface">Personal finance, understood.</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="text-sm font-medium bg-ink-800 text-white rounded-lg px-4 py-2 hover:bg-ink-900 transition-colors">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-ink hover:text-ink-600 px-3 py-2">Log in</Link>
                <Link to="/login" className="text-sm font-medium bg-ledger-600 text-white rounded-lg px-4 py-2 hover:bg-ledger-700 transition-colors">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_20%_-10%,rgba(31,111,84,0.08),transparent),radial-gradient(600px_300px_at_90%_20%,rgba(111,231,196,0.18),transparent)]" />
            <div className="ledger-spine absolute left-6 top-0 bottom-0 w-px opacity-60 hidden lg:block" />
            <div className="ledger-spine absolute right-6 top-0 bottom-0 w-px opacity-60 hidden lg:block" />
          </div>

          <div className="max-w-6xl mx-auto px-6 pt-14 pb-10 lg:pt-20 lg:pb-16 relative">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-start">
              <div>
                <p className="text-xs font-medium tracking-[0.14em] uppercase text-ledger-700 mb-4">Bank statements → clarity</p>
                <h1 className="font-display text-[40px] sm:text-[54px] leading-[0.95] tracking-[-0.02em] text-ink">
                  Know exactly
                  <br />
                  where it goes.
                </h1>
                <p className="text-[17px] leading-7 text-muted mt-5 max-w-[48ch]">
                  Finlytics reads the messy CSVs your bank actually exports. It sorts every line, spots the weird spend, and forecasts next month. No manual tagging.
                </p>

                <div className="flex flex-wrap gap-3 mt-7">
                  <Link to="/login" className="inline-flex items-center justify-center bg-ink-800 text-white text-sm font-medium rounded-lg px-6 py-3 hover:bg-ink-900 transition-colors">
                    Create your account
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center bg-surface border border-border text-ink text-sm font-medium rounded-lg px-6 py-3 hover:bg-paper transition-colors">
                    Log in
                  </Link>
                  <span className="inline-flex items-center text-xs text-muted px-2 py-3">Demo: demo@finlytics.app / demo1234</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-6 text-xs">
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-ledger-600" /> UPI • POS • NEFT • IMPS
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber" /> 10MB CSV • deduped by hash
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" /> On-device ML
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8 max-w-[520px]">
                  <div className="bg-surface border border-border rounded-xl2 p-4">
                    <p className="text-xs tracking-wider uppercase text-muted">Categorized</p>
                    <p className="font-mono tabular text-2xl text-ink mt-1">~97%</p>
                    <p className="text-xs text-muted mt-1">accuracy on statement text</p>
                  </div>
                  <div className="bg-surface border border-border rounded-xl2 p-4">
                    <p className="text-xs tracking-wider uppercase text-muted">Imports</p>
                    <p className="font-mono tabular text-2xl text-ink mt-1">10MB</p>
                    <p className="text-xs text-muted mt-1">CSV, any delimiter</p>
                  </div>
                  <div className="bg-surface border border-border rounded-xl2 p-4">
                    <p className="text-xs tracking-wider uppercase text-muted">Forecast</p>
                    <p className="font-mono tabular text-2xl text-ink mt-1">3 mo</p>
                    <p className="text-xs text-muted mt-1">to predict next</p>
                  </div>
                </div>
              </div>

              <div className="lg:pt-2">
                <MockPreview />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-ink-800 text-white rounded-xl2 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs tracking-wider uppercase text-white/60">Flagged as unusual</p>
                      <p className="font-mono tabular text-2xl mt-1">1</p>
                    </div>
                    <span className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-amber">●</span>
                  </div>
                  <div className="bg-surface border border-border rounded-xl2 p-4">
                    <p className="text-xs tracking-wider uppercase text-muted">Next month forecast</p>
                    <p className="font-mono tabular text-lg text-ink mt-1">₹31,200 <span className="text-xs text-muted">± ₹4.1k</span></p>
                    <p className="text-xs text-muted mt-1">80% confidence • ARIMA</p>
                  </div>
                </div>
                <p className="text-xs text-muted mt-3 text-center">Preview data — your import looks identical, with your categories.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Feature k="01" title="Auto-categorize at import" desc="Random Forest trained on Indian statement phrasing — UPI handles, POS codes, NEFT refs. You get Food, Travel, Bills, Shopping, Entertainment, Health, Other without tagging." />
            <Feature k="02" title="Flags the weird spend" desc="Isolation Forest on amount-for-category and day-of-week. A ₹3,299 Amazon on a day you usually spend ₹400 gets flagged. You decide if it stays." />
            <Feature k="03" title="Tells you next month" desc="ARIMA on your monthly totals. Needs 3 months of history. Shows a predicted total and a range, so you can plan without pretending it is precise." />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="bg-ink-800 rounded-xl2 overflow-hidden relative">
            <div className="ledger-spine absolute left-0 top-0 bottom-0 w-px opacity-30" />
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-0">
              <div className="p-8 lg:p-10">
                <p className="text-xs tracking-[0.14em] uppercase text-white/60">Why Finlytics</p>
                <h2 className="font-display text-[28px] leading-none text-white mt-3">Your bank exports are messy. That is the point.</h2>
                <p className="text-white/70 text-sm leading-6 mt-4 max-w-[48ch]">
                  Real exports say <span className="text-white">“UPI-SWIGGY-9841@okaxis-884192”</span> not “Swiggy”. We built column detection for Narration, Particulars, Withdrawal/Deposit splits and amount-in-paise math so rounding never drifts.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-white/80">
                  <li className="flex gap-2"><span className="text-mint">—</span> Hash dedupe: re-upload the same file, we stop you at 409.</li>
                  <li className="flex gap-2"><span className="text-mint">—</span> Per-row validation: bad dates or blank amounts are skipped and counted, not silently dropped.</li>
                  <li className="flex gap-2"><span className="text-mint">—</span> Ownership checks: your JWT only opens your rows. No `user_id` spoofing.</li>
                </ul>
                <div className="flex gap-3 mt-7">
                  <Link to="/login" className="bg-white text-ink-800 text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-paper transition-colors">Create account</Link>
                  <a href="https://github.com/sahilsk91/finlytics-live" target="_blank" rel="noreferrer" className="text-sm font-medium text-white/80 hover:text-white px-3 py-2.5">View code on GitHub →</a>
                </div>
              </div>
              <div className="bg-white/5 border-t lg:border-t-0 lg:border-l border-white/10 p-8 lg:p-10">
                <p className="text-xs tracking-wider uppercase text-white/60">How it works</p>
                <ol className="mt-4 space-y-4">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-white text-ink-800 grid place-items-center text-xs font-mono shrink-0">1</span>
                    <div>
                      <p className="text-sm font-medium text-white">Create an account</p>
                      <p className="text-sm text-white/60">Email + password. We hash, we issue a JWT. No passwords stored in plain text.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-white text-ink-800 grid place-items-center text-xs font-mono shrink-0">2</span>
                    <div>
                      <p className="text-sm font-medium text-white">Import a CSV or add manually</p>
                      <p className="text-sm text-white/60">10MB max. We sniff the delimiter, map the columns, and score every row.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-white text-ink-800 grid place-items-center text-xs font-mono shrink-0">3</span>
                    <div>
                      <p className="text-sm font-medium text-white">Use the dashboard</p>
                      <p className="text-sm text-white/60">Filter by category, search, see flagged spend and next-month forecast.</p>
                    </div>
                  </li>
                </ol>
                <div className="mt-6 bg-white rounded-xl2 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs tracking-wider uppercase text-muted">Your data</p>
                    <p className="text-sm font-medium text-ink">Isolated by account</p>
                    <p className="text-xs text-muted">Postgres in production, SQLite locally. Same schema.</p>
                  </div>
                  <span className="h-9 w-9 rounded-lg bg-ledger-600 text-white grid place-items-center">✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="bg-surface border border-border rounded-xl2 p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-2xl text-ink">Ready to see your spend clearly?</h3>
              <p className="text-sm text-muted mt-1">Create an account in 10 seconds. Demo data seeded, but your import is private to you.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link to="/login" className="bg-ledger-600 text-white text-sm font-medium rounded-lg px-6 py-3 hover:bg-ledger-700 transition-colors">Create account</Link>
              <Link to="/login" className="bg-paper border border-border text-ink text-sm font-medium rounded-lg px-6 py-3 hover:bg-surface transition-colors">Log in</Link>
            </div>
          </div>
          <p className="text-xs text-muted text-center mt-4">Finlytics • Built for Indian bank CSVs • No tracking • Your JWT, your rows</p>
        </section>
      </main>
    </div>
  );
}

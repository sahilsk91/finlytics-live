import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, visible];
}

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
    <div className="bg-surface rounded-[20px] shadow-[0_20px_60px_rgba(16,24,39,0.12),0_1px_3px_rgba(16,24,39,0.08)] border border-border overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 bg-paper/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2 w-2 rounded-full bg-ledger-600 animate-pulse-dot shrink-0" />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-ink truncate">Live preview — your data</span>
          <span className="hidden sm:inline text-[11px] text-muted">• auto-categorized</span>
        </div>
        <span className="text-[11px] font-mono tabular tracking-wide text-white bg-ink-800 rounded-full px-2.5 py-1 shrink-0">5 txns</span>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((r, i) => (
          <div
            key={r.desc}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 hover:bg-paper/60 transition-colors"
            style={{ animation: `fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${i * 70 + 300}ms` }}
          >
            <div className="flex items-center justify-between sm:contents">
              <span className="text-[11px] font-mono tabular tracking-wide text-muted sm:w-[84px] shrink-0 order-2 sm:order-1">{r.date}</span>
              <span className={`text-[11px] font-medium border rounded-full px-2 py-1 leading-none sm:hidden order-1 ${cats[r.cat]}`}>{r.cat}</span>
            </div>
            <span className="flex-1 text-[13px] sm:text-sm font-medium text-ink truncate flex items-center gap-2 min-w-0">
              <span className="truncate">{r.desc}</span>
              {r.flag && <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase text-white bg-amber rounded-full px-2 py-1">Flagged</span>}
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-auto">
              <span className={`hidden sm:inline-flex text-[11px] font-medium border rounded-full px-2.5 py-1 leading-none ${cats[r.cat]}`}>{r.cat}</span>
              <span className="text-[13px] sm:text-sm font-mono tabular font-medium text-ink sm:w-[92px] text-right">{r.amt}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 sm:px-5 py-3 bg-paper border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs text-muted flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-ledger-600" /> Scored at import • no manual tagging
        </span>
        <span className="text-xs font-mono tabular text-ink">Total <span className="font-semibold">₹5,977.00</span></span>
      </div>
    </div>
  );
}

function Feature({ k, title, desc, delay }) {
  const [ref, visible] = useInView(0.2);
  return (
    <div
      ref={ref}
      className={`group bg-surface rounded-[20px] border border-border p-6 sm:p-7 hover:shadow-[0_12px_40px_rgba(16,24,39,0.08)] hover:border-ink-800/10 hover:-translate-y-1 transition-all duration-300 ${visible ? "animate-fade-up" : "opacity-0"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4 mb-4">
        <span className="h-9 w-9 rounded-xl bg-ink-800 text-white grid place-items-center text-xs font-mono tabular font-medium shrink-0 group-hover:bg-ledger-600 transition-colors">{k}</span>
        <h3 className="font-display text-[17px] leading-6 text-ink pt-1">{title}</h3>
      </div>
      <p className="text-[14px] leading-6 text-muted">{desc}</p>
      <div className="mt-5 h-px bg-border group-hover:bg-ink-800/10 transition-colors" />
      <p className="text-xs font-medium tracking-wide uppercase text-muted mt-4 flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-ledger-600" /> {k === "01" ? "TF-IDF + Random Forest" : k === "02" ? "Isolation Forest" : "ARIMA • 80% band"}
      </p>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-paper overflow-x-hidden">
      <header className={`sticky top-0 z-40 border-b transition-all duration-300 ${scrolled ? "bg-paper/90 backdrop-blur-xl border-border shadow-[0_1px_12px_rgba(16,24,39,0.06)]" : "bg-paper/70 backdrop-blur border-transparent"}`}>
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <span className="font-display text-[22px] sm:text-[24px] tracking-[-0.02em] text-ink">Finlytics</span>
            <span className="hidden md:inline-flex text-[11px] tracking-[0.12em] uppercase font-medium text-muted border border-border rounded-full px-2.5 py-1 bg-surface">Personal finance, understood.</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted hover:text-ink transition-colors">Features</a>
            <a href="#how" className="text-muted hover:text-ink transition-colors">How it works</a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button onClick={toggle} aria-label="Toggle theme" className="h-10 w-10 grid place-items-center rounded-full border border-border bg-surface hover:bg-paper dark:bg-ink-800 dark:border-white/10 dark:text-white transition-colors">
              <span className="text-sm">{theme === "dark" ? "☀" : "☾"}</span>
            </button>
            {user ? (
              <Link to="/dashboard" className="text-sm font-medium bg-ink-800 text-white rounded-full px-5 py-2.5 hover:bg-ink-900 hover:shadow-[0_8px_20px_rgba(16,24,39,0.18)] hover:-translate-y-px transition-all">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-ink hover:bg-paper border border-transparent hover:border-border rounded-full px-4 py-2.5 transition-all">Log in</Link>
                <Link to="/login" className="text-sm font-semibold bg-ledger-600 text-white rounded-full px-5 py-2.5 hover:bg-ledger-700 hover:shadow-[0_8px_20px_rgba(31,111,84,0.3)] hover:-translate-y-px transition-all">Create account</Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-border bg-surface text-ink hover:bg-paper transition-colors"
            aria-label="Menu"
          >
            <span className="relative w-4 h-3">
              <span className={`absolute left-0 w-full h-0.5 bg-ink rounded-full transition-all ${menuOpen ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-1.5 w-full h-0.5 bg-ink rounded-full transition-all ${menuOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`absolute left-0 w-full h-0.5 bg-ink rounded-full transition-all ${menuOpen ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border bg-surface dark:bg-ink-800 animate-fade-in">
            <div className="px-4 py-4 space-y-1">
              <a onClick={() => setMenuOpen(false)} href="#features" className="block px-4 py-3 rounded-xl text-sm font-medium text-ink dark:text-white hover:bg-paper dark:hover:bg-white/10">Features</a>
              <a onClick={() => setMenuOpen(false)} href="#how" className="block px-4 py-3 rounded-xl text-sm font-medium text-ink dark:text-white hover:bg-paper dark:hover:bg-white/10">How it works</a>
              <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-ink dark:text-white bg-paper dark:bg-white/10 border border-border dark:border-white/10">
                <span>Theme</span>
                <span>{theme === "dark" ? "☀ Light" : "☾ Dark"}</span>
              </button>
              <div className="h-px bg-border dark:bg-white/10 my-3" />
              {user ? (
                <Link onClick={() => setMenuOpen(false)} to="/dashboard" className="block text-center bg-ink-800 text-white rounded-full px-5 py-3 font-medium">Go to dashboard</Link>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link onClick={() => setMenuOpen(false)} to="/login" className="text-center bg-paper dark:bg-white/10 border border-border dark:border-white/10 rounded-full px-5 py-3 text-sm font-medium dark:text-white">Log in</Link>
                  <Link onClick={() => setMenuOpen(false)} to="/login" className="text-center bg-ledger-600 text-white rounded-full px-5 py-3 text-sm font-semibold">Create account</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        <section ref={heroRef} className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_18%_-8%,rgba(31,111,84,0.09),transparent_60%),radial-gradient(700px_400px_at_92%_12%,rgba(111,231,196,0.16),transparent_60%),radial-gradient(600px_300px_at_50%_100%,rgba(232,150,60,0.06),transparent_70%)]" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(to right, #14171F 1px, transparent 1px), linear-gradient(to bottom, #14171F 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
            <div className="absolute -top-32 -right-32 w-[560px] h-[560px] bg-ledger-600/[0.07] rounded-full blur-[80px] animate-float hidden lg:block" />
            <div className="absolute -bottom-32 -left-32 w-[640px] h-[640px] bg-amber/[0.06] rounded-full blur-[90px] animate-float hidden lg:block" style={{ animationDelay: "2s" }} />
            <div className="ledger-spine absolute left-4 sm:left-6 top-0 bottom-0 w-px opacity-40 hidden lg:block" />
            <div className="ledger-spine absolute right-4 sm:right-6 top-0 bottom-0 w-px opacity-40 hidden lg:block" />
          </div>

          <div className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12 lg:pt-16 pb-8 sm:pb-10 relative">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-start">
              <div className={`${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "80ms" }}>
                <p className="text-[11px] tracking-[0.18em] uppercase font-semibold text-ledger-600 flex items-center gap-2">
                  <span className="h-px w-6 bg-ledger-600 hidden sm:block" /> Personal finance, understood
                </p>

                <h1 className="font-display text-[34px] sm:text-[48px] lg:text-[56px] leading-[0.9] tracking-[-0.025em] text-ink mt-4">
                  <span className="block overflow-hidden"><span className={`block ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "140ms" }}>Know exactly</span></span>
                  <span className="block overflow-hidden"><span className={`group inline-flex items-baseline gap-2 ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "220ms" }}>where it goes.<span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-ledger-600 inline-block translate-y-[-2px] group-hover:scale-125 transition-transform" /></span></span>
                </h1>

                <p className={`text-[16px] sm:text-[17px] leading-7 text-muted mt-5 max-w-[48ch] ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "300ms" }}>
                  Finlytics reads the messy CSVs your bank actually exports. It sorts every line, spots the weird spend, and forecasts next month. No manual tagging, no spreadsheet hell.
                </p>

                <div className={`flex flex-col sm:flex-row flex-wrap gap-3 mt-7 ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "380ms" }}>
                  <Link to="/login" className="group inline-flex items-center justify-center gap-2 bg-ink-800 text-white text-[15px] font-semibold rounded-full px-7 py-3.5 hover:bg-ink-900 hover:shadow-[0_16px_32px_rgba(16,24,39,0.22)] hover:-translate-y-1 active:translate-y-0 transition-all relative overflow-hidden">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">Create your account</span>
                    <span className="relative h-5 w-5 rounded-full bg-white/15 group-hover:bg-white/20 grid place-items-center text-xs transition-colors">→</span>
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center bg-white border border-border text-ink text-[15px] font-medium rounded-full px-7 py-3.5 hover:bg-paper hover:border-ink-800/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,39,0.06)] transition-all">
                    Log in
                  </Link>
                </div>

                <div className={`flex flex-wrap items-center gap-2 mt-6 ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "460ms" }}>
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow-sm hover:-translate-y-px hover:shadow-md hover:border-ink-800/10 transition-all cursor-default">
                    <span className="h-1.5 w-1.5 rounded-full bg-ledger-600" /> UPI • POS • NEFT • IMPS
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow-sm hover:-translate-y-px hover:shadow-md hover:border-ink-800/10 transition-all cursor-default">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber" /> 10MB CSV • hash deduped
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow-sm hover:-translate-y-px hover:shadow-md hover:border-ink-800/10 transition-all cursor-default">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" /> On-device ML
                  </span>
                </div>

                <div className={`grid grid-cols-3 gap-3 mt-6 max-w-[520px] ${mounted ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: "540ms" }}>
                  {[
                    { k: "Categorized", v: "~97%", s: "accuracy" },
                    { k: "Imports", v: "10MB", s: "any delimiter" },
                    { k: "Forecast", v: "3 mo", s: "to predict" },
                  ].map((x) => (
                    <div key={x.k} className="bg-surface/80 backdrop-blur border border-border rounded-2xl p-3 sm:p-4 hover:shadow-[0_8px_24px_rgba(16,24,39,0.06)] hover:-translate-y-0.5 transition-all">
                      <p className="text-[10px] tracking-[0.12em] uppercase font-semibold text-muted">{x.k}</p>
                      <p className="font-mono tabular text-[18px] sm:text-[22px] font-medium text-ink mt-1">{x.v}</p>
                      <p className="text-[11px] text-muted mt-1">{x.s}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`lg:pt-2 ${mounted ? "animate-scale-in" : "opacity-0"}`} style={{ animationDelay: "320ms" }}>
                <div className="animate-float will-change-transform hover:[animation-play-state:paused] transition-transform">
                  <MockPreview />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="group bg-ink-800 text-white rounded-2xl p-4 flex items-center justify-between hover:shadow-[0_12px_32px_rgba(16,24,39,0.18)] hover:-translate-y-0.5 transition-all">
                    <div>
                      <p className="text-[11px] tracking-[0.1em] uppercase font-semibold text-white/60">Flagged</p>
                      <p className="font-mono tabular text-[22px] font-medium mt-1">1 <span className="text-xs font-sans font-normal text-white/60">unusual</span></p>
                    </div>
                    <span className="h-9 w-9 rounded-xl bg-white/10 group-hover:bg-white/15 grid place-items-center text-amber transition-colors">●</span>
                  </div>
                  <div className="group bg-surface border border-border rounded-2xl p-4 hover:shadow-[0_12px_32px_rgba(16,24,39,0.06)] hover:-translate-y-0.5 transition-all">
                    <p className="text-[11px] tracking-[0.1em] uppercase font-semibold text-muted">Forecast</p>
                    <p className="font-mono tabular text-[16px] font-medium text-ink mt-1">₹31,200 <span className="text-xs text-muted font-normal">± ₹4.1k</span></p>
                    <p className="text-[11px] text-muted mt-1 flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-ledger-600" /> 80% band • ARIMA</p>
                  </div>
                </div>
                <p className="text-xs text-muted mt-3 text-center">Preview data — your import looks identical, with your own categories.</p>
              </div>
            </div>
            <div className="hidden lg:flex absolute bottom-4 left-1/2 -translate-x-1/2 flex-col items-center gap-2">
              <span className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted/40">Scroll</span>
              <span className="h-10 w-px bg-border relative overflow-hidden rounded-full">
                <span className="absolute inset-x-0 top-0 h-6 bg-ledger-600 rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]" />
              </span>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-[1120px] mx-auto px-4 sm:px-6 pb-6">
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h2 className="font-display text-[22px] sm:text-2xl tracking-tight text-ink">Everything you need, nothing you don’t.</h2>
            <span className="hidden sm:inline text-xs font-mono tabular tracking-wide text-muted border border-border rounded-full px-3 py-1.5 bg-surface">3 core engines</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
            <Feature k="01" title="Auto-categorize at import" desc="Random Forest on Indian statement phrasing — UPI handles, POS codes, NEFT refs. You get Food, Travel, Bills, Shopping, Entertainment, Health, Other without ever tagging." delay={0} />
            <Feature k="02" title="Flags the weird spend" desc="Isolation Forest on amount-for-category + day-of-week. A ₹3,299 Amazon on a day you usually spend ₹400 gets flagged. You decide if it stays." delay={120} />
            <Feature k="03" title="Tells you next month" desc="ARIMA on your monthly totals. Needs 3 months. Shows predicted total and a range so you can plan without pretending it is precise." delay={240} />
          </div>
        </section>

        <section id="how" className="max-w-[1120px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-ink-800 rounded-[24px] sm:rounded-[28px] overflow-hidden relative">
            <div className="ledger-spine absolute left-0 top-0 bottom-0 w-px opacity-20 hidden sm:block" />
            <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_80%_0%,rgba(111,231,196,0.12),transparent)] pointer-events-none" />
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-0 relative">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="text-[11px] tracking-[0.14em] uppercase font-semibold text-white/60">Why Finlytics</p>
                <h2 className="font-display text-[26px] sm:text-[30px] leading-[0.95] tracking-tight text-white mt-3">Your bank exports are messy. That is the point.</h2>
                <p className="text-white/70 text-[14px] leading-6 mt-4 max-w-[48ch]">
                  Real exports say <span className="text-white font-medium">“UPI-SWIGGY-9841@okaxis-884192”</span> not “Swiggy”. We built column detection for Narration, Particulars, Withdrawal / Deposit splits and paise math so rounding never drifts.
                </p>
                <ul className="mt-6 space-y-3 text-[14px] text-white/85">
                  <li className="flex gap-3"><span className="text-mint mt-1">—</span> <span>Hash dedupe: re-upload the same file, we stop you at 409.</span></li>
                  <li className="flex gap-3"><span className="text-mint mt-1">—</span> <span>Per-row validation: bad dates or blank amounts are skipped and counted, not silently dropped.</span></li>
                  <li className="flex gap-3"><span className="text-mint mt-1">—</span> <span>Ownership: your JWT only opens your rows. No user_id spoofing.</span></li>
                </ul>
                <div className="flex flex-wrap gap-3 mt-7">
                  <Link to="/login" className="bg-white text-ink-800 text-sm font-semibold rounded-full px-6 py-3 hover:bg-paper hover:shadow-[0_8px_20px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 transition-all">Create account</Link>
                </div>
              </div>
              <div className="bg-white/[0.06] backdrop-blur border-t lg:border-t-0 lg:border-l border-white/10 p-6 sm:p-8 lg:p-10">
                <p className="text-[11px] tracking-[0.12em] uppercase font-semibold text-white/60">How it works</p>
                <ol className="mt-5 space-y-5">
                  {[
                    { n: "1", t: "Create an account", d: "Email + password. We hash, we issue a JWT. No plain text." },
                    { n: "2", t: "Import a CSV or add manually", d: "10MB max. We sniff delimiter, map columns, score every row." },
                    { n: "3", t: "Use the dashboard", d: "Filter by category, search, see flagged spend and forecast." },
                  ].map((s) => (
                    <li key={s.n} className="flex gap-4 group">
                      <span className="h-8 w-8 rounded-full bg-white text-ink-800 grid place-items-center text-xs font-mono font-medium shrink-0 group-hover:scale-105 transition-transform">{s.n}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{s.t}</p>
                        <p className="text-[13px] leading-5 text-white/60 mt-1">{s.d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-7 bg-white rounded-2xl p-4 flex items-center justify-between shadow-[0_8px_24px_rgba(16,24,39,0.12)]">
                  <div>
                    <p className="text-[11px] tracking-[0.1em] uppercase font-semibold text-muted">Your data</p>
                    <p className="text-sm font-semibold text-ink">Isolated by account</p>
                    <p className="text-xs text-muted">Postgres in prod, SQLite locally.</p>
                  </div>
                  <span className="h-10 w-10 rounded-xl bg-ledger-600 text-white grid place-items-center shrink-0">✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-[1120px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-surface border border-border rounded-[24px] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-[0_8px_24px_rgba(16,24,39,0.04)]">
            <div>
              <h3 className="font-display text-[22px] sm:text-2xl tracking-tight text-ink">Ready to see your spend clearly?</h3>
              <p className="text-sm text-muted mt-1 max-w-[48ch]">Create an account in 10 seconds. Demo is seeded, but your import is private to you.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <Link to="/login" className="w-full sm:w-auto text-center bg-ledger-600 text-white text-sm font-semibold rounded-full px-7 py-3.5 hover:bg-ledger-700 hover:shadow-[0_8px_20px_rgba(31,111,84,0.25)] hover:-translate-y-0.5 transition-all">Create account</Link>
              <Link to="/login" className="w-full sm:w-auto text-center bg-paper border border-border text-ink text-sm font-medium rounded-full px-7 py-3.5 hover:bg-white hover:border-ink-800/10 hover:-translate-y-0.5 transition-all">Log in</Link>
            </div>
          </div>
          <p className="text-xs text-muted text-center mt-4">Finlytics • Built for Indian bank CSVs • No tracking • Your JWT, your rows • <span className="hidden sm:inline">Single-origin, 60ms health</span></p>
        </section>
      </main>

      <footer className="border-t border-border bg-paper">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-14 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <span>© 2026 Finlytics • <span className="hidden sm:inline">Personal finance, understood.</span></span>
          <span className="hidden sm:inline">Made for UPI • POS • NEFT</span>
        </div>
      </footer>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-paper via-paper to-transparent pointer-events-none">
        <div className="pointer-events-auto bg-ink-800 text-white rounded-full p-2 flex items-center gap-2 shadow-[0_12px_32px_rgba(16,24,39,0.22)] max-w-[420px] mx-auto">
          <span className="flex-1 text-sm font-medium pl-4 truncate">See where it goes?</span>
          <Link to="/login" className="bg-white text-ink-800 text-sm font-semibold rounded-full px-5 py-2.5 shrink-0">Create account</Link>
        </div>
      </div>
    </div>
  );
}

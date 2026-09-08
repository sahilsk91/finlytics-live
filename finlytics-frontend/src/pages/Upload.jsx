import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Card, PageHeader } from "../components/Card";
import CategoryBadge from "../components/CategoryBadge";
import Money from "../components/Money";

const CATEGORIES = [
  "Uncategorized", "Food", "Travel", "Bills",
  "Shopping", "Entertainment", "Health", "Other",
];

const STATUS_STYLES = {
  success: { label: "Imported", bg: "bg-ledger-50", fg: "text-ledger-700", border: "border-ledger-100" },
  partial: { label: "Partially imported", bg: "bg-amber/10", fg: "text-amber", border: "border-amber/20" },
  failed: { label: "Import failed", bg: "bg-danger/5", fg: "text-danger", border: "border-danger/20" },
};

function ImportSummary({ result }) {
  const { upload, category_counts, rows_skipped, transactions } = result;
  const style = STATUS_STYLES[upload.status] || STATUS_STYLES.failed;

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-lg text-ink">Import summary</h2>
        <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${style.bg} ${style.fg} ${style.border}`}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted mb-1">Rows in file</p>
          <p className="font-mono tabular text-2xl text-ink">{upload.rows_in_file}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted mb-1">Imported</p>
          <p className="font-mono tabular text-2xl text-ledger-600">{upload.rows_imported}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted mb-1">Skipped</p>
          <p className="font-mono tabular text-2xl text-amber">{rows_skipped}</p>
        </div>
      </div>

      {Object.keys(category_counts).length > 0 && (
        <div className="mb-2">
          <p className="text-xs uppercase tracking-wider text-muted mb-3">Auto-categorized as</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(category_counts).map(([category, count]) => (
              <div key={category} className="flex items-center gap-1.5">
                <CategoryBadge category={category} />
                <span className="text-xs text-muted font-mono">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions?.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border max-h-56 overflow-y-auto">
          {transactions.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-ink truncate mr-3">{t.description}</span>
              <Money paise={t.amount} size="sm" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Dropzone() {
  const { user } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }

    setUploading(true);
    try {
      const data = await api.uploadCsv(user.id, file);
      setResult(data);
    } catch (err) {
      if (err.status === 409) {
        setError("This exact file has already been imported.");
      } else {
        setError(err.message);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Card>
        <h2 className="font-display text-lg text-ink mb-1">Import a bank statement</h2>
        <p className="text-sm text-muted mb-5">
          CSV files only, up to 10MB. We auto-detect date, description, and amount columns.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer px-6 py-14 text-center ${
            dragOver ? "border-ledger-600 bg-ledger-50" : "border-border hover:border-ledger-600/50"
          } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <p className="font-medium text-ink mb-1">
            {uploading ? "Categorizing transactions\u2026" : "Drop your CSV here"}
          </p>
          {!uploading && <p className="text-sm text-muted">or click to browse</p>}
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </Card>

      {result && <div className="mt-6"><ImportSummary result={result} /></div>}
    </>
  );
}


function ManualEntryForm({ onAdded }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    category: "Uncategorized",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      const amountPaise = Math.round(parseFloat(form.amount) * 100);
      if (Number.isNaN(amountPaise)) throw new Error("Enter a valid amount");

      const tx = await api.createTransaction({
        user_id: user.id,
        date: form.date,
        description: form.description,
        amount: amountPaise,
        category: form.category,
      });
      setForm((f) => ({ ...f, description: "", amount: "" }));
      setSuccess(true);
      onAdded?.(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg text-ink mb-1">Add a transaction</h2>
      <p className="text-sm text-muted mb-5">For anything not on a statement.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={update("date")}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="450.00"
              value={form.amount}
              onChange={update("amount")}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm font-mono focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
          <input
            type="text"
            required
            placeholder="Swiggy order"
            value={form.description}
            onChange={update("description")}
            className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Category</label>
          <select
            value={form.category}
            onChange={update("category")}
            className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none bg-surface"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-ledger-700 bg-ledger-50 border border-ledger-100 rounded-lg px-3 py-2">
            Transaction added.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ledger-600 hover:bg-ledger-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {submitting ? "Adding\u2026" : "Add transaction"}
        </button>
      </form>
    </Card>
  );
}

export default function Upload() {
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Import"
        title="Add your spending"
        description="Bring in a statement or log transactions one at a time."
      />
      <div className="grid grid-cols-2 gap-6 items-start">
        <Dropzone />
        <ManualEntryForm />
      </div>
    </div>
  );
}

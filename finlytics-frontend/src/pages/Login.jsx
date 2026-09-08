import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      if (mode === "login" && err.status === 404) {
        setError("No account with that email yet. Switch to Create account below.");
      } else if (err.status === 401) {
        setError("Incorrect password.");
      } else if (err.status === 409) {
        setError(err.message);
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-800 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="ledger-spine absolute left-0 top-0 bottom-0 w-px" />
      <div className="ledger-spine absolute right-0 top-0 bottom-0 w-px" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-display text-4xl text-white tracking-tight">Finlytics</span>
          <p className="text-white/40 text-sm mt-2">Know exactly where it goes.</p>
        </div>

        <div className="bg-surface rounded-xl2 shadow-raised p-8">
          <div className="flex mb-6 bg-paper rounded-lg p-1 border border-border">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                mode === "login" ? "bg-surface shadow-card text-ink" : "text-muted"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
                mode === "signup" ? "bg-surface shadow-card text-ink" : "text-muted"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? "Your password" : "Min 6 characters"}
                className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm focus:border-ledger-600 focus:ring-1 focus:ring-ledger-600 outline-none transition-colors"
              />
              {mode === "signup" && (
                <p className="text-xs text-muted mt-1.5">Secured with JWT — your data stays isolated.</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ledger-600 hover:bg-ledger-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Demo: demo@finlytics.app / demo1234 <span className="text-white/20">(now password-protected)</span>
        </p>
      </div>
    </div>
  );
}

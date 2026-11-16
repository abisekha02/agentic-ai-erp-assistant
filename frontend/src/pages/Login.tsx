import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ username: "", email: "", first_name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "login") await login(f.username, f.password);
      else await register(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  };

  const field = "w-full rounded border border-rule bg-white px-3 py-2 text-sm";
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl font-semibold leading-tight">Northwind Knowledge Assistant</h1>
        <p className="mt-2 text-sm text-muted">Ask about company policy. Every answer shows the page it came from.</p>
        <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border border-rule bg-white p-5">
          <label className="block text-sm font-medium">Username
            <input className={`${field} mt-1`} value={f.username} onChange={set("username")} required autoComplete="username" />
          </label>
          {mode === "register" && (
            <>
              <label className="block text-sm font-medium">Name
                <input className={`${field} mt-1`} value={f.first_name} onChange={set("first_name")} />
              </label>
              <label className="block text-sm font-medium">Work email
                <input type="email" className={`${field} mt-1`} value={f.email} onChange={set("email")} required />
              </label>
            </>
          )}
          <label className="block text-sm font-medium">Password
            <input type="password" className={`${field} mt-1`} value={f.password} onChange={set("password")} required
              minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className="w-full rounded bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60">
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="mt-4 text-sm text-signal underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Create an employee account" : "I already have an account"}
        </button>
        <p className="mt-6 text-xs text-muted">Demo: priya / Employee@12345 (employee), admin / Admin@12345 (admin)</p>
      </div>
    </main>
  );
}

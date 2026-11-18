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

  const field = "w-full rounded-xl border border-rule bg-side px-3.5 py-2.5 text-[15px]";
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between p-10 text-white md:flex" style={{ background: "linear-gradient(160deg,#4E6AE6,#3A54CC 60%,#2F44A8)" }}>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded bg-signal text-base font-bold">N</div>
          <span className="text-lg font-semibold">Northwind</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">Answers from your company's documents, with the page to prove it.</h1>
          <ul className="mt-6 space-y-2 text-white/80">
            <li>Cited answers from policies and procedures</li>
            <li>Role-based access to confidential documents</li>
            <li>Leave requests that need your approval first</li>
          </ul>
        </div>
        <p className="text-sm text-white/50">Enterprise Knowledge Assistant</p>
      </section>
      <section className="grid place-items-center bg-paper px-4 py-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted">Northwind Knowledge Assistant</p>
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow-card">
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
            <button disabled={busy} className="w-full rounded-xl bg-signal px-3 py-3 text-[15px] font-semibold text-white hover:bg-signal-dark disabled:opacity-60">
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button className="mt-4 text-sm font-medium text-signal hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create an employee account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}

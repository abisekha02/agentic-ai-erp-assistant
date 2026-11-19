import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "../components/icons";

const delay = (s: number) => ({ animationDelay: `${s}s` });

function Feature({ icon, label }: { icon: "file" | "shield" | "check"; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><Icon name={icon} className="h-[18px] w-[18px]" /></div>
      <span className="text-sm font-medium text-white/90">{label}</span>
    </div>
  );
}

function Preview() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* floating badges */}
      <div className="anim-in absolute -right-4 -top-5 z-10" style={delay(2.8)}>
        <div className="anim-float flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-card">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[#DFF4F0] text-[#1B8F7E]"><Icon name="shield" className="h-3.5 w-3.5" /></span>
          Admin-only files stay private
        </div>
      </div>
      <div className="anim-in absolute -bottom-9 -left-6 z-10" style={delay(3.3)}>
        <div className="anim-float flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-card" style={{ animationDelay: "1.2s" }}>
          <span className="grid h-6 w-6 place-items-center rounded-md bg-slip-wash text-slip"><Icon name="check" className="h-3.5 w-3.5" /></span>
          Leave request awaiting approval
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 text-ink shadow-[0_20px_50px_rgba(10,20,80,0.35)]">
        <div className="mb-4 flex items-center gap-2 border-b border-rule pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B6B]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FFC857]" /><span className="h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
          <span className="ml-2 text-xs font-semibold text-muted">Assistant</span>
        </div>

        <div className="anim-in flex justify-end" style={delay(0.4)}>
          <p className="rounded-2xl rounded-br-md bg-signal px-3.5 py-2 text-sm text-white">What is the leave policy?</p>
        </div>

        <div className="relative mt-3 min-h-[118px]">
          <div className="typing anim-in absolute left-0 top-0 flex items-center gap-2" style={{ ...delay(1.0), animation: "fadeUp .4s ease-out 1s forwards, hide .01s linear 2.2s forwards" }}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-signal text-[10px] font-bold text-white">AI</span>
            <span className="flex gap-1 rounded-2xl bg-side px-3 py-2.5">
              {[0, 0.2, 0.4].map((d) => <i key={d} className="h-1.5 w-1.5 rounded-full bg-muted" style={{ animation: "dot 1s infinite", animationDelay: `${d}s` }} />)}
            </span>
          </div>

          <div className="anim-in flex gap-2" style={delay(2.3)}>
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal text-[10px] font-bold text-white">AI</span>
            <div className="min-w-0">
              <p className="rounded-2xl rounded-tl-md bg-side px-3.5 py-2.5 text-sm leading-relaxed">
                Full-time employees get <b>20 paid days</b> of annual leave per year, and can carry over up to 5 days
                <span className="mx-1 inline-grid h-[18px] w-[18px] place-items-center rounded bg-signal-wash text-[11px] font-semibold text-signal">1</span>
              </p>
              <div className="anim-in mt-2 flex w-max overflow-hidden rounded-lg border border-rule text-left" style={delay(2.9)}>
                <span className="grid w-7 place-items-center bg-signal-wash text-xs font-bold text-signal">1</span>
                <span className="px-2.5 py-1"><span className="block text-xs font-semibold text-signal">Leave Policy</span><span className="block text-[11px] text-muted">Page 1</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: "user" | "lock" | "mail"; children: ReactNode }) {
  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      {children}
    </div>
  );
}

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

  const input = "h-11 w-full rounded-xl border border-rule bg-side pl-10 pr-3.5 text-[15px]";
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex"
        style={{ background: "linear-gradient(160deg,#4E6AE6,#3A54CC 60%,#2F44A8)" }}>
        {/* decorative background */}
        <div className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to bottom, transparent, black 40%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 40%, transparent)" }} />
        <svg className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px]" viewBox="0 0 520 520" fill="none" aria-hidden
          style={{ animation: "drift 90s linear infinite" }}>
          <circle cx="260" cy="260" r="250" stroke="white" strokeOpacity=".14" strokeDasharray="4 10" />
          <circle cx="260" cy="260" r="190" stroke="white" strokeOpacity=".12" />
          <circle cx="260" cy="260" r="120" stroke="white" strokeOpacity=".1" />
        </svg>
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-base font-bold">N</div>
          <span className="text-lg font-bold tracking-wide">NORTHWIND</span>
        </div>

        <div className="relative">
          <h1 className="max-w-lg text-[34px] font-bold leading-tight">Answers from your company's documents, with the page to prove it.</h1>
          <div className="mt-8"><Preview /></div>
        </div>

        <div className="relative flex flex-wrap gap-x-7 gap-y-3">
          <Feature icon="file" label="Cited answers" />
          <Feature icon="shield" label="Role-based access" />
          <Feature icon="check" label="Approval before actions" />
        </div>
      </section>

      <section className="grid place-items-center bg-paper px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-signal text-white shadow-card"><Icon name="lock" className="h-6 w-6" /></div>
          <h2 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted">{mode === "login" ? "Sign in to the Northwind Knowledge Assistant" : "Register as an employee to start asking questions"}</p>
          <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-card">
            <label className="block text-sm font-semibold">Username
              <Field icon="user"><input className={input} value={f.username} onChange={set("username")} required autoComplete="username" /></Field>
            </label>
            {mode === "register" && (
              <>
                <label className="block text-sm font-semibold">Name
                  <Field icon="user"><input className={input} value={f.first_name} onChange={set("first_name")} /></Field>
                </label>
                <label className="block text-sm font-semibold">Work email
                  <Field icon="mail"><input type="email" className={input} value={f.email} onChange={set("email")} required /></Field>
                </label>
              </>
            )}
            <label className="block text-sm font-semibold">Password
              <Field icon="lock"><input type="password" className={input} value={f.password} onChange={set("password")} required
                minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></Field>
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={busy} className="h-11 w-full rounded-xl bg-signal text-[15px] font-semibold text-white hover:bg-signal-dark disabled:opacity-60">
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button className="mt-4 text-sm font-semibold text-signal hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create an employee account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}

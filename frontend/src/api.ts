const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api";
const KEY = "eka.tokens";

export interface Tokens { access: string; refresh: string }
// NOTE: localStorage is simple but readable by any XSS. For production, move the refresh token to an httpOnly cookie.
export const tokens = {
  get(): Tokens | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
  },
  set(t: Tokens) { localStorage.setItem(KEY, JSON.stringify(t)); },
  clear() { localStorage.removeItem(KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function explain(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === "string") return d.detail;
  const parts = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`);
  return parts.join("  ") || fallback;
}

async function refreshAccess(): Promise<boolean> {
  const t = tokens.get();
  if (!t) return false;
  const r = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: t.refresh }),
  });
  if (!r.ok) { tokens.clear(); return false; }
  const data = await r.json();
  tokens.set({ access: data.access, refresh: data.refresh ?? t.refresh });
  return true;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const t = tokens.get();
  const isForm = opts.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (t) headers.Authorization = `Bearer ${t.access}`;
  if (opts.body && !isForm) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers,
      body: opts.body ? (isForm ? (opts.body as FormData) : JSON.stringify(opts.body)) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check that the backend is running.");
  }
  if (res.status === 401 && retry && t && (await refreshAccess())) return api<T>(path, opts, false);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, explain(data, `Request failed (${res.status})`));
  return data as T;
}

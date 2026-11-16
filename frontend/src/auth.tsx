import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokens } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (v: { username: string; email: string; first_name: string; password: string }) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.get()) { setLoading(false); return; }
    api<User>("/auth/me/").then(setUser).catch(() => tokens.clear()).finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const d = await api<{ access: string; refresh: string; user: User }>("/auth/login/", { body: { username, password } });
    tokens.set({ access: d.access, refresh: d.refresh });
    setUser(d.user);
  };
  const register = async (v: { username: string; email: string; first_name: string; password: string }) => {
    await api("/auth/register/", { body: v });
    await login(v.username, v.password);
  };
  const logout = () => { tokens.clear(); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

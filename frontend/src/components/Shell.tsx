import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "./icons";

function Section({ icon, label }: { icon: "grid" | "layers"; label: string }) {
  return (
    <p className="mb-1 mt-5 flex items-center gap-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-muted first:mt-0">
      <Icon name={icon} className="h-4 w-4" />{label}
    </p>
  );
}

function Item({ to, label, icon, onClick }: { to: string; label: string; icon: "bars" | "chat" | "file"; onClick?: () => void }) {
  return (
    <NavLink to={to} end onClick={onClick}
      className={({ isActive }) =>
        `flex h-11 items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors ${
          isActive ? "bg-signal-wash text-signal" : "text-ink hover:bg-signal-wash/60"
        }`}>
      {({ isActive }) => (
        <>
          <Icon name={icon} className="h-[18px] w-[18px]" />
          <span className="flex-1">{label}</span>
          {isActive && <span className="h-2 w-2 rounded-full bg-signal" />}
        </>
      )}
    </NavLink>
  );
}

export default function Shell({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);
  const closeOnMobile = () => { if (window.innerWidth < 1024) setOpen(false); };
  const name = user?.first_name || user?.username || "";
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  const iconBtn = "grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-[68px] shrink-0 items-center justify-between bg-signal px-5 text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-lg font-bold">N</div>
            <span className="hidden text-xl font-bold tracking-wide sm:block">NORTHWIND</span>
          </div>
          <button onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/15" aria-label="Toggle menu">
            <Icon name="menu" />
          </button>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={fullscreen} className={`${iconBtn} hidden sm:grid`} aria-label="Toggle full screen"><Icon name="expand" /></button>
          <button onClick={logout} className={iconBtn} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
          <div className="ml-2 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/25 text-sm font-bold" aria-hidden>{name.slice(0, 2).toUpperCase()}</div>
            <div className="hidden leading-tight sm:block">
              <p className="text-[15px] font-semibold">{name}</p>
              <p className="text-[13px] capitalize text-white/80">{user?.role}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {open && (
          <>
            <div className="absolute inset-0 z-10 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
            <nav className="absolute inset-y-0 left-0 z-20 w-72 shrink-0 overflow-y-auto bg-side px-3 py-5 shadow-card lg:static lg:shadow-none" aria-label="Main">
              {user?.role === "admin" && (
                <>
                  <Section icon="grid" label="Dashboards" />
                  <Item to="/analytics" label="Analytics" icon="bars" onClick={closeOnMobile} />
                </>
              )}
              <Section icon="layers" label="Apps" />
              <Item to="/" label="Assistant" icon="chat" onClick={closeOnMobile} />
              {user?.role === "admin" && <Item to="/admin" label="Documents" icon="file" onClick={closeOnMobile} />}
            </nav>
          </>
        )}
        <div className={`flex min-w-0 flex-1 flex-col bg-paper p-5 sm:p-6 ${fill ? "overflow-hidden" : "overflow-y-auto"}`}>{children}</div>
      </div>
    </div>
  );
}

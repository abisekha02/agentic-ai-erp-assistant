import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Chat from "./pages/Chat";
import Login from "./pages/Login";

function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Guard><Chat /></Guard>} />
      <Route path="/analytics" element={<Guard admin><Analytics /></Guard>} />
      <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

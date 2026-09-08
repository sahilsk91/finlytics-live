import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppShell from "./AppShell";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();

  if (!ready) return null; // avoid flashing a redirect before localStorage is read
  if (!user) return <Navigate to="/login" replace />;

  return <AppShell>{children}</AppShell>;
}

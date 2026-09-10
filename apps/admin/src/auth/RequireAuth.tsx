import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, accessToken } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

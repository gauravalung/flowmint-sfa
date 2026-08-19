import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EmployeePublic, LoginResponse } from "@flowmint/shared";
import { api, ApiRequestError } from "../api/client";
import { saveTokens, loadTokens, clearTokens } from "../storage/secureStore";

interface AuthState {
  isLoading: boolean;
  employee: EmployeePublic | null;
  accessToken: string | null;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeePublic | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    // On cold start, try to resume a session from secure storage. We don't
    // have a "who am I" endpoint yet, so restoring `employee` details isn't
    // possible from tokens alone in v1 — the beat/catalog screens (Slice B/C)
    // will re-fetch employee-scoped data using the stored access token, and
    // a 401 there triggers the refresh-then-retry path.
    (async () => {
      const tokens = await loadTokens();
      if (tokens) {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (employeeCode: string, password: string) => {
    const result = await api.post<LoginResponse>("/auth/login", { employeeCode, password });
    await saveTokens(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
    setEmployee(result.employee);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
    setEmployee(null);
  }, []);

  const value = useMemo(
    () => ({ isLoading, employee, accessToken, login, logout }),
    [isLoading, employee, accessToken, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiRequestError };

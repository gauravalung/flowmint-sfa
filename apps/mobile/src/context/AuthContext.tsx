import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EmployeePublic, LoginResponse } from "@flowmint/shared";
import { api, ApiRequestError } from "../api/client";
import * as tokenStore from "../auth/tokenStore";

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

  useEffect(() => {
    (async () => {
      await tokenStore.hydrate();
      setAccessToken(tokenStore.getAccessToken());
      setIsLoading(false);
    })();

    // Keeps this context's accessToken in sync when tokenStore silently
    // refreshes (or clears, on an unrecoverable 401) from inside a screen's
    // API call — not just from login()/logout() called directly here.
    return tokenStore.subscribe((state) => setAccessToken(state.accessToken));
  }, []);

  const login = useCallback(async (employeeCode: string, password: string) => {
    const result = await api.post<LoginResponse>("/auth/login", { employeeCode, password });
    await tokenStore.setTokens(result);
    setEmployee(result.employee);
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.clear();
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

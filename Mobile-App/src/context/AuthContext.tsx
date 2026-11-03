import React, { createContext, useContext, useState, type ReactNode } from "react";
import {
  clearAuthToken,
  setAuthToken,
  type AuthSession,
  type AuthUser,
} from "../services/api";

type AuthContextValue = {
  isLoggedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (session: AuthSession) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function login(session: AuthSession) {
    setUser(session.user);
    setToken(session.token);
    setAuthToken(session.token);
  }

  function logout() {
    setUser(null);
    setToken(null);
    clearAuthToken();
  }

  const value = {
    isLoggedIn: Boolean(user),
    user,
    token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("pms_token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("pms_user");
    return raw ? JSON.parse(raw) : null;
  });

  function login({ token, user }) {
    setToken(token);
    setUser(user || null);
    localStorage.setItem("pms_token", token);
    localStorage.setItem("pms_user", JSON.stringify(user || null));
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("pms_token");
    localStorage.removeItem("pms_user");
  }

  const value = useMemo(() => ({ token, user, login, logout }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

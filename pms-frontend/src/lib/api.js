import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export function useApi() {
  const { token } = useAuth();

  const api = useCallback(
    async (path, opts = {}) => {
      const base =
        import.meta.env.VITE_API_URL ||
        "https://pms-backend-d3e1.onrender.com/";

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${String(token).trim()}` } : {}),
        ...(opts.headers || {}),
      };

      // Debug opcional:
      // console.log("🔗", base + path, headers);

      const res = await fetch(base + path, { ...opts, headers });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let message = res.statusText || "Erro na requisicao";
        let payload = null;

        if (ct.includes("application/json")) {
          payload = await res.json().catch(() => null);
          if (payload && typeof payload === "object") {
            message = payload.error || payload.message || message;
          }
        } else {
          const txt = await res.text().catch(() => "");
          if (txt) message = txt;
        }

        const error = new Error(message);
        error.status = res.status;
        error.payload = payload;
        throw error;
      }

      const ct = res.headers.get("content-type") || "";
      return ct.includes("application/json") ? res.json() : res.text();
    },
    [token] // <- api só muda quando o token mudar
  );

  return api;
}

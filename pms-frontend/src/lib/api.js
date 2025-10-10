import { useAuth } from "../context/AuthContext";

export function useApi() {
  const { token } = useAuth();

  return async function api(path, opts = {}) {
    const base = import.meta.env.VITE_API_URL || "https://pms-backend.onrender.com";
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${String(token).trim()}` } : {}),
      ...(opts.headers || {}),
    };

    // Debug opcional:
    // console.log("🔗", base + path, headers);

    const res = await fetch(base + path, { ...opts, headers });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || res.statusText);
    }

    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  };
}

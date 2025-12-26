import axios from "axios";

const BASE =
  (import.meta.env.VITE_API_URL || "https://pms-backend-d3e1.onrender.com")
    .replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${BASE}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

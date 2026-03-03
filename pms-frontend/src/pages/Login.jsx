import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDefaultPath } from "../lib/permissions";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const base = import.meta.env.VITE_API_URL || "https://pms-backend-d3e1.onrender.com/";
      const res = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (!data.token) throw new Error("Token não retornado pelo servidor");

      login({ token: data.token, user: data.user });
      nav(getDefaultPath(data.user));
    } catch (err) {
      console.error(err);
      setError("Falha no login: " + (err.message || "verifique suas credenciais"));
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow">
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="w-full py-2 rounded-lg bg-blue-600 text-white">
          Entrar
        </button>
      </form>
    </div>
  );
}

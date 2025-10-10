import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
      const base = import.meta.env.VITE_API_URL || "http://localhost:3333";
      const res = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (!data.token) throw new Error("Token não retornado pelo servidor");

      login({ token: data.token, user: data.user });
      nav("/map");
    } catch (err) {
      console.error(err);
      setError("Falha no login: " + (err.message || "verifique suas credenciais"));
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
      <h1 className="text-lg font-semibold mb-4">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
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

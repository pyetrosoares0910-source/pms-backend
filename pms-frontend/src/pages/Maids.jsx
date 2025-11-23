import { useEffect, useState } from "react";
import { useApi } from "../lib/api";

export default function Maids() {
  const api = useApi();
  const [maids, setMaids] = useState([]);
  const [form, setForm] = useState({
    name: "",
    bank: "",
    pixKey: "",
    available: [],
  });
  const [editingId, setEditingId] = useState(null);

  const loadMaids = async () => {
    try {
      const res = await api("/maids");
      setMaids(res);
    } catch (err) {
      console.error("Erro ao carregar diaristas:", err);
    }
  };

  useEffect(() => {
    loadMaids();
  }, []);

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      available: prev.available.includes(day)
        ? prev.available.filter((d) => d !== day)
        : [...prev.available, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api(`/maids/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await api("/maids", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }

      setForm({ name: "", bank: "", pixKey: "", available: [] });
      setEditingId(null);
      loadMaids();
    } catch (err) {
      console.error("Erro ao salvar diarista:", err);
    }
  };

  const handleEdit = (maid) => {
    setForm({
      name: maid.name || "",
      bank: maid.bank || "",
      pixKey: maid.pixKey || "",
      available: maid.available || [],
    });
    setEditingId(maid.id);
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover diarista?")) return;
    try {
      await api(`/maids/${id}`, { method: "DELETE" });
      loadMaids();
    } catch (err) {
      console.error("Erro ao remover diarista:", err);
    }
  };

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-6 space-y-8 bg-gray-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <h1 className="text-3xl font-bold mb-4">Cadastro de Diaristas</h1>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-5 rounded-2xl shadow"
      >
        {/* Nome */}
        <input
          type="text"
          placeholder="Nome da diarista"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input input-bordered w-full
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          required
        />

        {/* Banco */}
        <input
          type="text"
          placeholder="Banco"
          value={form.bank}
          onChange={(e) => setForm({ ...form, bank: e.target.value })}
          className="input input-bordered w-full
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          required
        />

        {/* Pix */}
        <input
          type="text"
          placeholder="Chave Pix"
          value={form.pixKey}
          onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
          className="input input-bordered w-full
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          required
        />

        {/* Disponibilidade */}
        <div className="flex gap-4 flex-wrap">
          {days.map((day) => (
            <label
              key={day}
              className="flex items-center gap-1 text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                checked={form.available.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {day}
            </label>
          ))}
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-sky-700 text-white px-6 py-2 rounded-lg hover:bg-sky-800"
          >
            {editingId ? "Atualizar" : "Salvar"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", bank: "", pixKey: "", available: [] });
              }}
              className="px-4 py-2 rounded-lg border dark:border-slate-600"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {/* TABELA */}
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
            <tr>
              <th className="px-4 py-2 border dark:border-slate-700">Nome</th>
              <th className="px-4 py-2 border dark:border-slate-700">Banco</th>
              <th className="px-4 py-2 border dark:border-slate-700">Chave Pix</th>
              <th className="px-4 py-2 border dark:border-slate-700">Disponibilidade</th>
              <th className="px-4 py-2 border dark:border-slate-700">Criado em</th>
              <th className="px-4 py-2 border dark:border-slate-700 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {maids.length > 0 ? (
              maids.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  <td className="px-4 py-2 border dark:border-slate-700">{m.name}</td>
                  <td className="px-4 py-2 border dark:border-slate-700">{m.bank}</td>
                  <td className="px-4 py-2 border dark:border-slate-700">{m.pixKey}</td>
                  <td className="px-4 py-2 border dark:border-slate-700">
                    {m.available?.join(", ")}
                  </td>
                  <td className="px-4 py-2 border dark:border-slate-700">
                    {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 border dark:border-slate-700 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(m)}
                      className="btn btn-xs btn-warning"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="btn btn-xs btn-error"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="6"
                  className="text-center text-gray-400 dark:text-slate-500 py-4"
                >
                  Nenhuma diarista cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

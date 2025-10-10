import { useEffect, useState } from "react";
import { useApi } from "../lib/api";

export default function Maids() {
  const api = useApi();
  const [maids, setMaids] = useState([]);
  const [form, setForm] = useState({ name: "", bank: "", pixKey: "", available: [] });
  const [editingId, setEditingId] = useState(null);

  // carregar diaristas
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

  // marcar/demarcar dias
  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      available: prev.available.includes(day)
        ? prev.available.filter((d) => d !== day)
        : [...prev.available, day],
    }));
  };

  // salvar (criar ou atualizar)
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

  // editar diarista
  const handleEdit = (maid) => {
    setForm({
      name: maid.name || "",
      bank: maid.bank || "",
      pixKey: maid.pixKey || "",
      available: maid.available || [],
    });
    setEditingId(maid.id);
  };

  // remover diarista
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
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Cadastro de Diaristas</h1>

      {/* Formulário */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white p-4 rounded-xl shadow"
      >
        <input
          type="text"
          placeholder="Nome da diarista"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input input-bordered w-full"
          required
        />

        <input
          type="text"
          placeholder="Banco"
          value={form.bank}
          onChange={(e) => setForm({ ...form, bank: e.target.value })}
          className="input input-bordered w-full"
          required
        />

        <input
          type="text"
          placeholder="Chave Pix"
          value={form.pixKey}
          onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
          className="input input-bordered w-full"
          required
        />

        <div className="flex gap-4 flex-wrap">
          {days.map((day) => (
            <label key={day} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.available.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {day}
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-sky-700 border-sky-800 btn btn-primary px-6"
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
              className="btn btn-ghost"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 border">Nome</th>
              <th className="px-4 py-2 border">Banco</th>
              <th className="px-4 py-2 border">Chave Pix</th>
              <th className="px-4 py-2 border">Disponibilidade</th>
              <th className="px-4 py-2 border">Criado em</th>
              <th className="px-4 py-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {maids.length > 0 ? (
              maids.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{m.name}</td>
                  <td className="px-4 py-2 border">{m.bank}</td>
                  <td className="px-4 py-2 border">{m.pixKey}</td>
                  <td className="px-4 py-2 border">
                    {m.available?.join(", ")}
                  </td>
                  <td className="px-4 py-2 border">
                    {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 border flex gap-2 justify-center">
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
                <td colSpan="6" className="text-center text-gray-400 py-4">
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

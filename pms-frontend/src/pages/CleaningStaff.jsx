import { useEffect, useState } from "react";
import api from "../api/axios";

export default function CleaningStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    status: "disponivel", // status inicial
  });

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    status: "disponivel",
  });

  // Buscar equipe de limpeza
  const fetchStaff = async () => {
    try {
      const res = await api.get("/cleaning-staff");
      setStaff(res.data);
    } catch (err) {
      console.error("Erro ao carregar equipe de limpeza:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Criar
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/cleaning-staff", formData);
      setFormData({ name: "", status: "disponivel" });
      fetchStaff();
    } catch (err) {
      console.error("Erro ao criar membro da equipe:", err);
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este funcionário de limpeza?")) return;
    try {
      await api.delete(`/cleaning-staff/${id}`);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  // Editar
  const handleEdit = (member) => {
    setEditId(member.id);
    setEditData({
      name: member.name,
      status: member.status,
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({ name: "", status: "disponivel" });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/cleaning-staff/${id}`, editData);
      setEditId(null);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao atualizar:", err);
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Equipe de Limpeza</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-2 gap-4 bg-white p-4 rounded shadow"
      >
        <input
          type="text"
          placeholder="Nome"
          className="border p-2 rounded"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <select
          className="border p-2 rounded"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          <option value="disponivel">Disponível</option>
          <option value="em_servico">Em Serviço</option>
          <option value="indisponivel">Indisponível</option>
        </select>
        <button
          type="submit"
          className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Adicionar
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id} className="border-t">
              {editId === member.id ? (
                <>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="border p-1 rounded w-full"
                      value={editData.status}
                      onChange={(e) =>
                        setEditData({ ...editData, status: e.target.value })
                      }
                    >
                      <option value="disponivel">Disponível</option>
                      <option value="em_servico">Em Serviço</option>
                      <option value="indisponivel">Indisponível</option>
                    </select>
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleUpdate(member.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500"
                    >
                      Cancelar
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2">{member.name}</td>
                  <td className="p-2 capitalize">{member.status}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(member)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Excluir
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {staff.length === 0 && (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-500">
                Nenhum funcionário de limpeza cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

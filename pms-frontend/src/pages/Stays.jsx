import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Stays() {
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", position: "" });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({ name: "", position: "" });

  // Buscar empreendimentos
  const fetchStays = async () => {
    try {
      const res = await api.get("/stays");
      setStays(res.data);
    } catch (err) {
      console.error("Erro ao carregar empreendimentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStays();
  }, []);

  // Criar
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/stays", {
        name: formData.name,
        position:
          formData.position !== ""
            ? parseInt(formData.position, 10)
            : null,
      });
      setFormData({ name: "", position: "" });
      fetchStays();
    } catch (err) {
      console.error("Erro ao criar empreendimento:", err);
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este empreendimento?")) return;
    try {
      await api.delete(`/stays/${id}`);
      fetchStays();
    } catch (err) {
      console.error("Erro ao excluir empreendimento:", err);
    }
  };

  // Editar
  const handleEdit = (stay) => {
    setEditId(stay.id);
    setEditData({
      name: stay.name,
      position: stay.position ?? "",
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({ name: "", position: "" });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/stays/${id}`, {
        name: editData.name,
        position:
          editData.position !== ""
            ? parseInt(editData.position, 10)
            : null,
      });
      setEditId(null);
      fetchStays();
    } catch (err) {
      console.error("Erro ao atualizar empreendimento:", err);
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Empreendimentos</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-3 gap-4 bg-white p-4 rounded shadow"
      >
        <input
          type="text"
          placeholder="Nome do Empreendimento"
          className="border p-2 rounded col-span-2"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          required
        />
        <input
          type="number"
          placeholder="Posição"
          className="border p-2 rounded"
          value={formData.position}
          onChange={(e) =>
            setFormData({ ...formData, position: e.target.value })
          }
        />
        <button
          type="submit"
          className="col-span-3 bg-sky-700 text-white py-2 rounded hover:bg-sky-800"
        >
          Cadastrar
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-center w-24">Posição</th>
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-center w-40">Ações</th>
          </tr>
        </thead>
        <tbody>
          {stays.map((stay) => (
            <tr key={stay.id} className="border-t">
              {editId === stay.id ? (
                <>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      className="border p-1 rounded w-20 text-center"
                      value={editData.position}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          position: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          name: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleUpdate(stay.id)}
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
                  <td className="p-2 text-center">
                    {stay.position ?? "-"}
                  </td>
                  <td className="p-2">{stay.name}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(stay)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(stay.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Excluir
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {stays.length === 0 && (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-500">
                Nenhum empreendimento cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

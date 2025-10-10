import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
  });

  const [editId, setEditId] = useState(null); // 🔹 ID em edição
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
  });

  // 🔹 Buscar lista
  const fetchGuests = async () => {
    try {
      const res = await api.get("/guests");
      setGuests(res.data);
    } catch (err) {
      console.error("Erro ao carregar hóspedes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  // 🔹 Criar novo hóspede
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/guests", formData);
      setFormData({ name: "", email: "", phone: "", document: "" });
      fetchGuests();
    } catch (err) {
      console.error("Erro ao criar hóspede:", err);
    }
  };

  // 🔹 Excluir hóspede
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este hóspede?")) return;
    try {
      await api.delete(`/guests/${id}`);
      fetchGuests();
    } catch (err) {
      console.error("Erro ao excluir hóspede:", err);
    }
  };

  // 🔹 Ativar modo edição
  const handleEdit = (guest) => {
    setEditId(guest.id);
    setEditData({
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      document: guest.document,
    });
  };

  // 🔹 Cancelar edição
  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({ name: "", email: "", phone: "", document: "" });
  };

  // 🔹 Salvar edição
  const handleUpdate = async (id) => {
    try {
      await api.put(`/guests/${id}`, editData);
      setEditId(null);
      fetchGuests();
    } catch (err) {
      console.error("Erro ao atualizar hóspede:", err);
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Hóspedes</h1>

      {/* Formulário de cadastro */}
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
        <input
          type="email"
          placeholder="E-mail"
          className="border p-2 rounded"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Telefone"
          className="border p-2 rounded"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <input
          type="text"
          placeholder="Documento"
          className="border p-2 rounded"
          value={formData.document}
          onChange={(e) =>
            setFormData({ ...formData, document: e.target.value })
          }
        />
        <button
          type="submit"
          className="col-span-2 bg-sky-700 text-white py-2 rounded hover:bg-sky-800"
        >
          Cadastrar
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-left">E-mail</th>
            <th className="p-2 text-left">Telefone</th>
            <th className="p-2 text-left">Documento</th>
            <th className="p-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr key={guest.id} className="border-t">
              {editId === guest.id ? (
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
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.phone || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, phone: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.document || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, document: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleUpdate(guest.id)}
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
                  <td className="p-2">{guest.name}</td>
                  <td className="p-2">{guest.email}</td>
                  <td className="p-2">{guest.phone}</td>
                  <td className="p-2">{guest.document}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(guest)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(guest.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Excluir
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {guests.length === 0 && (
            <tr>
              <td colSpan="5" className="p-4 text-center text-gray-500">
                Nenhum hóspede cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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

  const [editId, setEditId] = useState(null);
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

  if (loading)
    return (
      <p className="p-6 text-slate-700 dark:text-slate-200">
        Carregando...
      </p>
    );

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <h1 className="text-3xl font-bold mb-6">Hóspedes</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-2 gap-4 bg-white p-4 rounded shadow
                   dark:bg-slate-900 dark:border dark:border-slate-700"
      >
        <input
          type="text"
          placeholder="Nome"
          className="border p-2 rounded bg-white dark:bg-slate-900 
                     border-gray-300 dark:border-slate-700 
                     text-slate-900 dark:text-slate-100"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <input
          type="email"
          placeholder="E-mail"
          className="border p-2 rounded bg-white dark:bg-slate-900 
                     border-gray-300 dark:border-slate-700 
                     text-slate-900 dark:text-slate-100"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />

        <input
          type="text"
          placeholder="Telefone"
          className="border p-2 rounded bg-white dark:bg-slate-900 
                     border-gray-300 dark:border-slate-700 
                     text-slate-900 dark:text-slate-100"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />

        <input
          type="text"
          placeholder="Documento"
          className="border p-2 rounded bg-white dark:bg-slate-900 
                     border-gray-300 dark:border-slate-700 
                     text-slate-900 dark:text-slate-100"
          value={formData.document}
          onChange={(e) =>
            setFormData({ ...formData, document: e.target.value })
          }
        />

        <button
          type="submit"
          className="col-span-2 bg-sky-700 text-white py-2 rounded hover:bg-sky-800
                     transition-colors"
        >
          Cadastrar
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white shadow rounded
                        dark:bg-slate-900 dark:border dark:border-slate-700">
        <thead>
          <tr className="bg-gray-200 dark:bg-slate-800">
            <th className="p-2 text-left text-slate-800 dark:text-slate-100">
              Nome
            </th>
            <th className="p-2 text-left text-slate-800 dark:text-slate-100">
              E-mail
            </th>
            <th className="p-2 text-left text-slate-800 dark:text-slate-100">
              Telefone
            </th>
            <th className="p-2 text-left text-slate-800 dark:text-slate-100">
              Documento
            </th>
            <th className="p-2 text-center text-slate-800 dark:text-slate-100">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {guests.map((guest) => (
            <tr
              key={guest.id}
              className="border-t border-gray-200 dark:border-slate-700"
            >
              {editId === guest.id ? (
                <>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full 
                                bg-white dark:bg-slate-900 
                                border-gray-300 dark:border-slate-700 
                                text-slate-900 dark:text-slate-100"
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full 
                                bg-white dark:bg-slate-900 
                                border-gray-300 dark:border-slate-700 
                                text-slate-900 dark:text-slate-100"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full 
                                bg-white dark:bg-slate-900 
                                border-gray-300 dark:border-slate-700 
                                text-slate-900 dark:text-slate-100"
                      value={editData.phone}
                      onChange={(e) =>
                        setEditData({ ...editData, phone: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full 
                                bg-white dark:bg-slate-900 
                                border-gray-300 dark:border-slate-700 
                                text-slate-900 dark:text-slate-100"
                      value={editData.document}
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
                  <td className="p-2 text-slate-800 dark:text-slate-100">
                    {guest.name}
                  </td>
                  <td className="p-2 text-slate-800 dark:text-slate-100">
                    {guest.email}
                  </td>
                  <td className="p-2 text-slate-800 dark:text-slate-100">
                    {guest.phone}
                  </td>
                  <td className="p-2 text-slate-800 dark:text-slate-100">
                    {guest.document}
                  </td>

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
              <td
                colSpan="5"
                className="p-4 text-center text-gray-500 dark:text-slate-400"
              >
                Nenhum hóspede cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

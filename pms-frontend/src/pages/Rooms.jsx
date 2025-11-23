import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    position: "",
    description: "",
    active: true,
    stayId: "",
  });

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    title: "",
    category: "",
    position: "",
    description: "",
    active: true,
    stayId: "",
  });

  // Buscar Rooms + Stays
  const fetchRoomsAndStays = async () => {
    try {
      const [resRooms, resStays] = await Promise.all([
        api.get("/rooms"),
        api.get("/stays"),
      ]);
      setRooms(resRooms.data);
      setStays(resStays.data);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomsAndStays();
  }, []);

  // Criar
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/rooms", formData);
      setFormData({
        title: "",
        category: "",
        position: "",
        description: "",
        active: true,
        stayId: "",
      });
      fetchRoomsAndStays();
    } catch (err) {
      console.error("Erro ao criar quarto:", err);
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este quarto?")) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchRoomsAndStays();
    } catch (err) {
      console.error("Erro ao excluir quarto:", err);
    }
  };

  // Editar
  const handleEdit = (room) => {
    setEditId(room.id);
    setEditData({
      title: room.title,
      category: room.category,
      position: room.position,
      description: room.description,
      active: room.active,
      stayId: room.stayId || "",
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({
      title: "",
      category: "",
      position: "",
      description: "",
      active: true,
      stayId: "",
    });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/rooms/${id}`, editData);
      setEditId(null);
      fetchRoomsAndStays();
    } catch (err) {
      console.error("Erro ao atualizar quarto:", err);
    }
  };

  // Upload Imagem
  const handleImageUpload = async (id, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("image", file);
      await api.post(`/rooms/${id}/image`, formData);
      fetchRoomsAndStays();
    } catch (err) {
      console.error("Erro ao enviar imagem:", err);
      alert("Erro ao enviar imagem.");
    }
  };

  if (loading)
    return <p className="text-slate-700 dark:text-slate-200">Carregando...</p>;

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <h1 className="text-3xl font-bold mb-6">Unidades Habitacionais (UH)</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-2 gap-4 bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-4 rounded shadow"
      >
        <input
          type="text"
          placeholder="Título"
          className="border p-2 rounded col-span-2
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        <input
          type="text"
          placeholder="Categoria"
          className="border p-2 rounded
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          required
        />

        <input
          type="text"
          placeholder="Posição"
          className="border p-2 rounded
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          value={formData.position}
          onChange={(e) =>
            setFormData({ ...formData, position: e.target.value })
          }
        />

        <textarea
          placeholder="Descrição"
          className="border p-2 rounded col-span-2
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />

        <label className="flex items-center gap-2 col-span-2">
          <input
            type="checkbox"
            checked={formData.active}
            onChange={(e) =>
              setFormData({ ...formData, active: e.target.checked })
            }
          />
          Unidade ativa?
        </label>

        <select
          className="border p-2 rounded col-span-2
                     bg-white dark:bg-slate-900
                     border-gray-300 dark:border-slate-700
                     text-slate-900 dark:text-slate-100"
          value={formData.stayId}
          onChange={(e) => setFormData({ ...formData, stayId: e.target.value })}
        >
          <option value="">Selecione o Empreendimento</option>
          {stays.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="col-span-2 bg-sky-700 text-white py-2 rounded hover:bg-sky-800"
        >
          Cadastrar UH
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white dark:bg-slate-900 dark:border dark:border-slate-700 shadow rounded">
        <thead>
          <tr className="bg-gray-200 dark:bg-slate-800">
            <th className="p-2 text-left dark:text-slate-100">Imagem</th>
            <th className="p-2 text-left dark:text-slate-100">Título</th>
            <th className="p-2 text-left dark:text-slate-100">Categoria</th>
            <th className="p-2 text-left dark:text-slate-100">Posição</th>
            <th className="p-2 text-left dark:text-slate-100">Descrição</th>
            <th className="p-2 text-left dark:text-slate-100">Empreendimento</th>
            <th className="p-2 text-center dark:text-slate-100">Ativo?</th>
            <th className="p-2 text-center dark:text-slate-100">Ações</th>
          </tr>
        </thead>

        <tbody>
          {rooms.map((room) => (
            <tr
              key={room.id}
              className="border-t border-gray-200 dark:border-slate-700"
            >
              {editId === room.id ? (
                <>
                  {/* Imagem */}
                  <td className="p-2 text-center">
                    {room.imageUrl ? (
                      <img
                        src={room.imageUrl}
                        alt={room.title}
                        className="w-20 h-16 object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-400 dark:text-slate-400 text-sm">
                        Sem imagem
                      </span>
                    )}
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full
                                 bg-white dark:bg-slate-900
                                 border-gray-300 dark:border-slate-700
                                 text-slate-900 dark:text-slate-100"
                      value={editData.title}
                      onChange={(e) =>
                        setEditData({ ...editData, title: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full
                                 bg-white dark:bg-slate-900
                                 border-gray-300 dark:border-slate-700
                                 text-slate-900 dark:text-slate-100"
                      value={editData.category}
                      onChange={(e) =>
                        setEditData({ ...editData, category: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full
                                 bg-white dark:bg-slate-900
                                 border-gray-300 dark:border-slate-700
                                 text-slate-900 dark:text-slate-100"
                      value={editData.position}
                      onChange={(e) =>
                        setEditData({ ...editData, position: e.target.value })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <textarea
                      className="border p-1 rounded w-full
                                 bg-white dark:bg-slate-900
                                 border-gray-300 dark:border-slate-700
                                 text-slate-900 dark:text-slate-100"
                      value={editData.description}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          description: e.target.value,
                        })
                      }
                    />
                  </td>

                  <td className="p-2">
                    <select
                      className="border p-1 rounded w-full
                                 bg-white dark:bg-slate-900
                                 border-gray-300 dark:border-slate-700
                                 text-slate-900 dark:text-slate-100"
                      value={editData.stayId}
                      onChange={(e) =>
                        setEditData({ ...editData, stayId: e.target.value })
                      }
                    >
                      {stays.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={editData.active}
                      onChange={(e) =>
                        setEditData({ ...editData, active: e.target.checked })
                      }
                    />
                  </td>

                  <td className="p-2 flex flex-col items-center gap-2">
                    <button
                      onClick={() => handleUpdate(room.id)}
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
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={room.imageUrl || "/placeholder.jpg"}
                        alt={room.title}
                        className="w-20 h-16 object-cover rounded border border-gray-200 dark:border-slate-700"
                      />
                      <label className="text-xs text-sky-700 dark:text-sky-400 hover:underline cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) =>
                            handleImageUpload(room.id, e.target.files[0])
                          }
                        />
                        Atualizar
                      </label>
                    </div>
                  </td>

                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {room.title}
                  </td>

                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {room.category}
                  </td>

                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {room.position}
                  </td>

                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {room.description}
                  </td>

                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {room.stay?.name || "-"}
                  </td>

                  <td className="p-2 text-center">
                    {room.active ? "✅" : "❌"}
                  </td>

                  <td className="p-2 flex flex-col items-center gap-2">
                    <button
                      onClick={() => handleEdit(room)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 w-24"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(room.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 w-24"
                    >
                      Excluir
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}

          {rooms.length === 0 && (
            <tr>
              <td
                colSpan="8"
                className="p-4 text-center text-gray-500 dark:text-slate-400"
              >
                Nenhuma UH cadastrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

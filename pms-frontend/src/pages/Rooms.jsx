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

  // Upload da imagem (nova função)
  const handleImageUpload = async (id, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("image", file);

      await api.post(`/rooms/${id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      fetchRoomsAndStays();
    } catch (err) {
      console.error("Erro ao enviar imagem:", err);
      alert("Erro ao enviar imagem.");
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Unidades Habitacionais (UH)</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-2 gap-4 bg-white p-4 rounded shadow"
      >
        <input
          type="text"
          placeholder="Título"
          className="border p-2 rounded col-span-2"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        <input
          type="text"
          placeholder="Categoria"
          className="border p-2 rounded"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          required
        />

        <input
          type="text"
          placeholder="Posição"
          className="border p-2 rounded"
          value={formData.position}
          onChange={(e) =>
            setFormData({ ...formData, position: e.target.value })
          }
        />

        <textarea
          placeholder="Descrição"
          className="border p-2 rounded col-span-2"
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
          className="border p-2 rounded col-span-2"
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
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Imagem</th>
            <th className="p-2 text-left">Título</th>
            <th className="p-2 text-left">Categoria</th>
            <th className="p-2 text-left">Posição</th>
            <th className="p-2 text-left">Descrição</th>
            <th className="p-2 text-left">Empreendimento</th>
            <th className="p-2 text-center">Ativo?</th>
            <th className="p-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-t">
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
                      <span className="text-gray-400 text-sm">Sem imagem</span>
                    )}
                  </td>

                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.title}
                      onChange={(e) =>
                        setEditData({ ...editData, title: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.category}
                      onChange={(e) =>
                        setEditData({ ...editData, category: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.position}
                      onChange={(e) =>
                        setEditData({ ...editData, position: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <textarea
                      className="border p-1 rounded w-full"
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
                      className="border p-1 rounded w-full"
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
                  {/* Imagem com upload */}
                  <td className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={room.imageUrl || "/placeholder.jpg"}
                        alt={room.title}
                        className="w-20 h-16 object-cover rounded border border-gray-200"
                      />
                      <label className="text-xs text-sky-700 hover:underline cursor-pointer">
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

                  <td className="p-2">{room.title}</td>
                  <td className="p-2">{room.category}</td>
                  <td className="p-2">{room.position}</td>
                  <td className="p-2">{room.description}</td>
                  <td className="p-2">{room.stay?.name || "-"}</td>
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
              <td colSpan="8" className="p-4 text-center text-gray-500">
                Nenhuma UH cadastrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    guestId: "",
    roomId: "",
    checkinDate: "",
    checkoutDate: "",
    status: "agendada",
  });

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    guestId: "",
    roomId: "",
    checkinDate: "",
    checkoutDate: "",
    status: "agendada",
  });

  // 🔹 Buscar lista de reservas, hóspedes e quartos
  const fetchData = async () => {
    try {
      const [resReservations, resGuests, resRooms] = await Promise.all([
        api.get("/reservations"),
        api.get("/guests"),
        api.get("/rooms"),
      ]);
      setReservations(resReservations.data);
      setGuests(resGuests.data);
      setRooms(resRooms.data);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🔹 Criar nova reserva
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/reservations", formData);
      setFormData({
        guestId: "",
        roomId: "",
        checkinDate: "",
        checkoutDate: "",
        status: "agendada",
      });
      fetchData();
    } catch (err) {
      console.error("Erro ao criar reserva:", err);
    }
  };

  // 🔹 Excluir reserva
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir esta reserva?")) return;
    try {
      await api.delete(`/reservations/${id}`);
      fetchData();
    } catch (err) {
      console.error("Erro ao excluir reserva:", err);
    }
  };

  // 🔹 Ativar modo edição
  const handleEdit = (reservation) => {
    setEditId(reservation.id);
    setEditData({
      guestId: reservation.guestId,
      roomId: reservation.roomId,
      checkinDate: reservation.checkinDate.split("T")[0],
      checkoutDate: reservation.checkoutDate.split("T")[0],
      status: reservation.status,
    });
  };

  // 🔹 Cancelar edição
  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({
      guestId: "",
      roomId: "",
      checkinDate: "",
      checkoutDate: "",
      status: "agendada",
    });
  };

  // 🔹 Salvar edição
  const handleUpdate = async (id) => {
    try {
      await api.put(`/reservations/${id}`, editData);
      setEditId(null);
      fetchData();
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
    }
  };

  // abreviação
  function abbrevStay(name) {
  const map = {
    "Itaim Stay (Tabapuã)": "Itaim",
    "Itaim Stay 2 (Tabapuã)": "Itaim 2",
    "JK Stay (Clodomiro)": "JK",
    "Internacional Stay (Urussuí)": "Internacional",
    "Iguatemi Stay A (Butantã)": "Iguatemi A",
    "Iguatemi Stay B (Butantã)": "Iguatemi B",
    "Estanconfor Vila Olímpia": "Vila Olímpia",
  };
  if (map[name]) return map[name];
  return name?.split("(")[0]?.trim() || name;
}


  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reservas</h1>

      {/* Formulário de cadastro */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-2 gap-4 bg-white p-4 rounded shadow"
      >
        <select
          className="border p-2 rounded"
          value={formData.guestId}
          onChange={(e) => setFormData({ ...formData, guestId: e.target.value })}
          required
        >
          <option value="">Selecione o hóspede</option>
          {guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={formData.roomId}
          onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
          required
        >
          <option value="">Selecione o quarto</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} ({r.type})
            </option>
          ))}
        </select>

        <input
          type="date"
          className="border p-2 rounded"
          value={formData.checkinDate}
          onChange={(e) =>
            setFormData({ ...formData, checkinDate: e.target.value })
          }
          required
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={formData.checkoutDate}
          onChange={(e) =>
            setFormData({ ...formData, checkoutDate: e.target.value })
          }
          required
        />

        <select
          className="border p-2 rounded"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          <option value="agendada">Agendada</option>
          <option value="ativa">Ativa</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <button
          type="submit"
          className="col-span-2 bg-sky-700 text-white py-2 rounded hover:bg-sky-800"
        >
          Cadastrar Reserva
        </button>
      </form>

      {/* Tabela de reservas */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Hóspede</th>
            <th className="p-2 text-left">Quarto</th>
            <th className="p-2 text-left">Check-in</th>
            <th className="p-2 text-left">Check-out</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((res) => (
            <tr key={res.id} className="border-t">
              {editId === res.id ? (
                <>
                  <td className="p-2">
                    <select
                      className="border p-1 rounded"
                      value={editData.guestId}
                      onChange={(e) =>
                        setEditData({ ...editData, guestId: e.target.value })
                      }
                    >
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="border p-1 rounded"
                      value={editData.roomId}
                      onChange={(e) =>
                        setEditData({ ...editData, roomId: e.target.value })
                      }
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.number} ({r.type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      className="border p-1 rounded"
                      value={editData.checkinDate}
                      onChange={(e) =>
                        setEditData({ ...editData, checkinDate: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      className="border p-1 rounded"
                      value={editData.checkoutDate}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          checkoutDate: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="border p-1 rounded"
                      value={editData.status}
                      onChange={(e) =>
                        setEditData({ ...editData, status: e.target.value })
                      }
                    >
                      <option value="agendada">Agendada</option>
                      <option value="ativa">Ativa</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleUpdate(res.id)}
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
                  <td className="p-2">{res.guest?.name}</td>
                  <td className="p-2">{res.room? `${res.room.title} 
                        (${abbrevStay(res.room.stay?.name)})`: "—"}</td>
                  <td className="p-2">{res.checkinDate?.split("T")[0]}</td>
                  <td className="p-2">{res.checkoutDate?.split("T")[0]}</td>
                  <td className="p-2 capitalize">{res.status}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(res)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(res.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Excluir
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {reservations.length === 0 && (
            <tr>
              <td colSpan="6" className="p-4 text-center text-gray-500">
                Nenhuma reserva cadastrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    phone: "",
  });

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    role: "",
    phone: "",
  });

  // Buscar
  const fetchStaff = async () => {
    try {
      const res = await api.get("/staff");
      setStaff(res.data);
    } catch (err) {
      console.error("Erro ao carregar funcionários:", err);
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
      await api.post("/staff", formData);
      setFormData({ name: "", role: "", phone: "" });
      fetchStaff();
    } catch (err) {
      console.error("Erro ao criar funcionário:", err);
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este funcionário?")) return;
    try {
      await api.delete(`/staff/${id}`);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao excluir funcionário:", err);
    }
  };

  // Editar
  const handleEdit = (employee) => {
    setEditId(employee.id);
    setEditData({
      name: employee.name,
      role: employee.role,
      phone: employee.phone,
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({ name: "", role: "", phone: "" });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/staff/${id}`, editData);
      setEditId(null);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao atualizar funcionário:", err);
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Funcionários</h1>

      {/* Formulário */}
      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-3 gap-4 bg-white p-4 rounded shadow"
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
          type="text"
          placeholder="Função"
          className="border p-2 rounded"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Telefone"
          className="border p-2 rounded"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <button
          type="submit"
          className="col-span-3 bg-sky-700 text-white py-2 rounded hover:bg-sky-800"
        >
          Cadastrar Funcionário
        </button>
      </form>

      {/* Tabela */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-left">Função</th>
            <th className="p-2 text-left">Telefone</th>
            <th className="p-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((employee) => (
            <tr key={employee.id} className="border-t">
              {editId === employee.id ? (
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
                      value={editData.role}
                      onChange={(e) =>
                        setEditData({ ...editData, role: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 rounded w-full"
                      value={editData.phone}
                      onChange={(e) =>
                        setEditData({ ...editData, phone: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleUpdate(employee.id)}
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
                  <td className="p-2">{employee.name}</td>
                  <td className="p-2">{employee.role}</td>
                  <td className="p-2">{employee.phone}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
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
              <td colSpan="4" className="p-4 text-center text-gray-500">
                Nenhum funcionário cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

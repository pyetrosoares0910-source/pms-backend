import { useEffect, useState } from "react";
import api from "../api/axios";

const roleOptions = ["ADMIN", "STAFF", "VIEWER"];

const initialFormData = {
  name: "",
  email: "",
  password: "",
  role: "",
  phone: "",
  active: true,
};

const initialEditData = {
  name: "",
  email: "",
  password: "",
  role: "",
  phone: "",
  active: true,
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(initialFormData);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(initialEditData);
  const [submitError, setSubmitError] = useState("");

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

  const getErrorMessage = (err, fallback) =>
    err?.response?.data?.error ||
    err?.response?.data?.errors?.[0]?.msg ||
    fallback;

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitError("");

    try {
      await api.post("/staff", formData);
      setFormData(initialFormData);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao criar funcionário:", err);
      setSubmitError(getErrorMessage(err, "Erro ao criar funcionário."));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este funcionário?")) return;
    try {
      await api.delete(`/staff/${id}`);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao excluir funcionário:", err);
    }
  };

  const handleEdit = (employee) => {
    setEditId(employee.id);
    setEditData({
      name: employee.name || "",
      email: employee.email || "",
      password: "",
      role: employee.role || "",
      phone: employee.phone || "",
      active: employee.active ?? true,
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData(initialEditData);
  };

  const handleUpdate = async (id) => {
    try {
      const payload = {
        name: editData.name,
        email: editData.email,
        role: editData.role,
        phone: editData.phone,
        active: editData.active,
      };

      if (editData.password.trim()) {
        payload.password = editData.password;
      }

      await api.put(`/staff/${id}`, payload);
      setEditId(null);
      setEditData(initialEditData);
      fetchStaff();
    } catch (err) {
      console.error("Erro ao atualizar funcionário:", err);
    }
  };

  if (loading) {
    return <p className="text-slate-700 dark:text-slate-200">Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <h1 className="mb-6 text-3xl font-bold">Funcionários</h1>

      <form
        onSubmit={handleCreate}
        className="mb-6 grid grid-cols-1 gap-4 rounded bg-white p-4 shadow dark:border dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3"
      >
        <input
          type="text"
          placeholder="Nome"
          className="rounded border border-gray-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="E-mail"
          className="rounded border border-gray-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="rounded border border-gray-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />
        <select
          className="rounded border border-gray-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          required
        >
          <option value="">Selecione a função</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Telefone"
          className="rounded border border-gray-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <label className="flex items-center gap-2 rounded border border-gray-300 bg-white p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
          />
          Usuário ativo
        </label>

        {submitError && (
          <div className="md:col-span-3 text-sm text-red-600 dark:text-red-400">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          className="rounded bg-sky-700 py-2 text-white hover:bg-sky-800 md:col-span-3"
        >
          Cadastrar Funcionário
        </button>
      </form>

      <table className="w-full rounded bg-white shadow dark:border dark:border-slate-700 dark:bg-slate-900">
        <thead>
          <tr className="bg-gray-200 dark:bg-slate-800">
            <th className="p-2 text-left dark:text-slate-100">Nome</th>
            <th className="p-2 text-left dark:text-slate-100">E-mail</th>
            <th className="p-2 text-left dark:text-slate-100">Função</th>
            <th className="p-2 text-left dark:text-slate-100">Telefone</th>
            <th className="p-2 text-left dark:text-slate-100">Status</th>
            <th className="p-2 text-center dark:text-slate-100">Ações</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((employee) => (
            <tr
              key={employee.id}
              className="border-t border-gray-200 dark:border-slate-700"
            >
              {editId === employee.id ? (
                <>
                  <td className="p-2">
                    <input
                      className="w-full rounded border border-gray-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="email"
                      className="w-full rounded border border-gray-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full rounded border border-gray-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={editData.role}
                      onChange={(e) =>
                        setEditData({ ...editData, role: e.target.value })
                      }
                    >
                      <option value="">Selecione a função</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      className="w-full rounded border border-gray-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={editData.phone}
                      onChange={(e) =>
                        setEditData({ ...editData, phone: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editData.active}
                        onChange={(e) =>
                          setEditData({ ...editData, active: e.target.checked })
                        }
                      />
                      Ativo
                    </label>
                    <input
                      type="password"
                      placeholder="Nova senha"
                      className="mt-2 w-full rounded border border-gray-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={editData.password}
                      onChange={(e) =>
                        setEditData({ ...editData, password: e.target.value })
                      }
                    />
                  </td>
                  <td className="flex gap-2 justify-center p-2">
                    <button
                      onClick={() => handleUpdate(employee.id)}
                      className="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="rounded bg-gray-400 px-3 py-1 text-white hover:bg-gray-500"
                    >
                      Cancelar
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {employee.name}
                  </td>
                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {employee.email}
                  </td>
                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {employee.role}
                  </td>
                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {employee.phone || "-"}
                  </td>
                  <td className="p-2 text-slate-900 dark:text-slate-100">
                    {employee.active ? "Ativo" : "Inativo"}
                  </td>
                  <td className="flex gap-2 justify-center p-2">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="rounded bg-yellow-500 px-3 py-1 text-white hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
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
              <td
                colSpan="6"
                className="p-4 text-center text-gray-500 dark:text-slate-400"
              >
                Nenhum funcionário cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

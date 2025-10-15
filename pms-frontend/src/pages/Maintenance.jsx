import { useEffect, useState } from "react";
import { useApi } from "../lib/api";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-neutral-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [stays, setStays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", type: "", stayId: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    stayId: "",
    roomId: "",
    responsible: "",
    status: "pendente",
    type: "corretiva",
    dueDate: "",
    isRecurring: false,
    recurrence: { mode: "monthly_by_day", days: [], startDate: "" },
  });

  useEffect(() => {
    (async () => {
      const [staysRes, roomsRes, tasksRes] = await Promise.all([
        api("/stays"),
        api("/rooms"),
        api("/maintenance?includeModels=true"),
      ]);
      setStays(staysRes);
      setRooms(roomsRes);
      setTasks(tasksRes);
      setLoading(false);
    })();
  }, []);

  async function reloadTasks() {
    const updated = await api("/maintenance?includeModels=true");
    setTasks(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api("/maintenance", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      setForm({
        title: "",
        description: "",
        stayId: "",
        roomId: "",
        responsible: "",
        status: "pendente",
        type: "corretiva",
        dueDate: "",
        isRecurring: false,
        recurrence: { mode: "monthly_by_day", days: [], startDate: "" },
      });
      await reloadTasks();
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      alert("Erro ao criar tarefa");
    }
  }

  async function handleGenerate(id) {
    if (!window.confirm("Gerar próximas ocorrências deste modelo?")) return;
    try {
      const res = await api(`/maintenance/${id}/generate?months=12`, {
        method: "POST",
      });
      alert(res.message || "Ocorrências geradas com sucesso!");
      await reloadTasks();
    } catch (err) {
      console.error("Erro ao gerar recorrências:", err);
      alert("Erro ao gerar recorrências");
    }
  }

  function colorByStatus(status, type) {
    if (type === "preventiva") return "bg-neutral-400 text-white";
    switch (status) {
      case "pendente": return "bg-yellow-400 text-black";
      case "andamento": return "bg-blue-500 text-white";
      case "concluido": return "bg-emerald-600 text-white";
      default: return "bg-gray-300";
    }
  }

  const filtered = tasks.filter(
    (t) =>
      (!filters.status || t.status === filters.status) &&
      (!filters.type || t.type === filters.type) &&
      (!filters.stayId || t.stayId === filters.stayId)
  );

  return (
  <div className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-semibold">Atividades</h1>
      <button
        onClick={() => setModalOpen(true)}
        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Adicionar tarefa
      </button>
    </div>

    {/* === MINI DASHBOARD === */}
    {!loading && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Modelos recorrentes */}
        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Modelos recorrentes</p>
            <p className="text-xl font-semibold text-emerald-700">
              {tasks.filter((t) => t.isRecurring).length}
            </p>
          </div>
          <span className="text-emerald-600 text-2xl">🧩</span>
        </div>

        {/* Atividades ativas */}
        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Atividades ativas</p>
            <p className="text-xl font-semibold text-blue-600">
              {
                tasks.filter(
                  (t) =>
                    !t.isRecurring &&
                    (t.status === "pendente" || t.status === "andamento")
                ).length
              }
            </p>
          </div>
          <span className="text-blue-500 text-2xl">💭</span>
        </div>

        {/* Concluídas */}
        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Concluídas</p>
            <p className="text-xl font-semibold text-emerald-600">
              {tasks.filter((t) => t.status === "concluido").length}
            </p>
          </div>
          <span className="text-emerald-600 text-2xl">✅</span>
        </div>
      </div>
    )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 bg-white p-3 rounded shadow-sm">
        <select
          className="border rounded-lg px-3 py-2"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Status (todos)</option>
          <option value="pendente">Pendente</option>
          <option value="andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">Tipo (todos)</option>
          <option value="corretiva">Corretiva</option>
          <option value="preventiva">Preventiva</option>
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={filters.stayId}
          onChange={(e) => setFilters({ ...filters, stayId: e.target.value })}
        >
          <option value="">Empreendimento (todos)</option>
          {stays.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <p>Carregando tarefas...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-neutral-100 text-sm">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Título</th>
                <th className="px-3 py-2 text-left">Empreendimento</th>
                <th className="px-3 py-2 text-left">UH / Local</th>
                <th className="px-3 py-2 text-left">Responsável</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Tipo</th>
                <th className="px-3 py-2 text-center">Prazo</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={`border-t text-sm ${t.isRecurring ? "bg-emerald-50" : ""}`}>
                  <td className="p-2">{t.code}</td>
                  <td className="p-2">
                    {t.title}
                    {t.isRecurring && (
                      <span title="Modelo recorrente" className="ml-2 text-emerald-600 text-xs">♻️</span>
                    )}
                  </td>
                  <td className="p-2">{t.stay?.name || "-"}</td>
                  <td className="p-2">{t.room?.title || "-"}</td>
                  <td className="p-2">{t.responsible || "-"}</td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorByStatus(t.status, t.type)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-2 text-center capitalize">{t.type}</td>
                  <td className="p-2 text-center">
                    {t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString("pt-BR")
                      : t.isRecurring
                      ? "Modelo"
                      : "-"}
                  </td>
                  <td className="p-2 text-center">
                    {t.isRecurring && (
                      <button
                        onClick={() => handleGenerate(t.id)}
                        className="text-emerald-700 hover:underline text-xs"
                      >
                        Gerar próximas
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de criação */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Atividade">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-sm">Título</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm">Descrição</label>
            <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm">Empreendimento</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.stayId}
              onChange={(e) => setForm({ ...form, stayId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {stays.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Unidade (opcional)</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.roomId}
              onChange={(e) => setForm({ ...form, roomId: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Responsável</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm">Prazo</label>
            <input
              type="date"
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm">Status</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pendente">Pendente</option>
              <option value="andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="corretiva">Corretiva</option>
              <option value="preventiva">Preventiva</option>
            </select>
          </div>

          {/* Recorrência */}
          <div className="col-span-2 border-t pt-3 mt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              />
              <span className="font-medium">Tornar recorrente</span>
            </label>

            {form.isRecurring && (
              <div className="mt-3 grid grid-cols-2 gap-4 rounded-lg border p-3 bg-neutral-50">
                <div className="col-span-2">
                  <label className="text-sm">Modo</label>
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={form.recurrence.mode}
                    onChange={(e) =>
                      setForm({ ...form, recurrence: { ...form.recurrence, mode: e.target.value } })
                    }
                  >
                    <option value="monthly_by_day">Mensal (dia fixo)</option>
                    <option value="monthly_twice">Mensal (2x no mês)</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="yearly_firstWeek">Anual (1ª semana)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Data inicial</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={form.recurrence.startDate}
                    onChange={(e) =>
                      setForm({ ...form, recurrence: { ...form.recurrence, startDate: e.target.value } })
                    }
                  />
                </div>

                {(form.recurrence.mode === "monthly_by_day" || form.recurrence.mode === "monthly_twice") && (
                  <div className="col-span-2">
                    <label className="text-sm">Dia(s) do mês</label>
                    <input
                      placeholder="Ex.: 5,20"
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={form.recurrence.days.join(",")}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recurrence: {
                            ...form.recurrence,
                            days: e.target.value.split(",").map((d) => Number(d.trim())),
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
              Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

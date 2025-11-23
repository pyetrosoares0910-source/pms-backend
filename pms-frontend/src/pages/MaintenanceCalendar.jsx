import { useEffect, useState } from "react";
import { useApi } from "../lib/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptLocale from "@fullcalendar/core/locales/pt-br";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-800 dark:text-slate-100 
        border border-gray-200 dark:border-slate-700
        rounded-2xl shadow-2xl w-full max-w-md mx-4 transition-colors duration-300">

        <div className="px-5 py-3 border-b border-neutral-200 dark:border-slate-700 
                        flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-neutral-600 dark:text-slate-300">✕</button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function MaintenanceCalendar() {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editDate, setEditDate] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/maintenance");
        setTasks(data);
      } catch (e) {
        console.error("Erro ao carregar tarefas:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ===== CORES (modo claro + escuro) =====
  function colorByStatus(task) {
    if (task.type === "preventiva") return "#6B7280"; // cinza

    switch (task.status) {
      case "pendente":
        return "#FACC15"; // amarelo
      case "andamento":
        return "#3B82F6"; // azul
      case "concluido":
        return "#10B981"; // verde
      default:
        return "#9CA3AF";
    }
  }

  const events = tasks.map((t) => {
    let raw = t.dueDate || t.createdAt;

    if (typeof raw === "string" && raw.endsWith("Z")) {
      raw = raw.slice(0, -1);
    }

    const date = new Date(raw);
    date.setHours(12, 0, 0, 0);

    return {
      id: t.id,
      title: `${t.title}${t.responsible ? " - " + t.responsible : ""}`,
      start: date,
      backgroundColor: colorByStatus(t),
      borderColor: colorByStatus(t),
      textColor: t.status === "pendente" ? "black" : "white",
      extendedProps: t,
    };
  });

  async function handleUpdate() {
    if (!selected) return;
    try {
      await api(`/maintenance/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editStatus,
          dueDate: editDate,
        }),
      });
      setSelected(null);
      const updated = await api("/maintenance");
      setTasks(updated);
    } catch (err) {
      alert("Erro ao atualizar tarefa");
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm("Deseja realmente excluir esta tarefa?")) return;
    setDeleting(true);
    try {
      await api(`/maintenance/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      const updated = await api("/maintenance");
      setTasks(updated);
    } catch (err) {
      alert("Erro ao deletar tarefa");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  function handleEventClick(info) {
    const task = info.event.extendedProps;
    setSelected(task);
    setEditStatus(task.status);
    setEditDate(task.dueDate ? task.dueDate.split("T")[0] : "");
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-slate-950 
                    text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <h1 className="text-3xl font-bold mb-6">Agenda de Atividades</h1>

      {loading ? (
        <p>Carregando tarefas...</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 dark:border-slate-700 
                        border border-neutral-200 rounded-2xl shadow p-3 transition-colors duration-300">

          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={ptLocale}
            height="85vh"
            timeZone="local"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
            }}
            events={events}
            eventClick={handleEventClick}
            eventDisplay="block"
            dayHeaderClassNames="text-xs text-gray-500 dark:text-slate-400"
          />
        </div>
      )}

      {/* Modal de edição */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Editar tarefa"
      >
        {selected && (
          <div className="space-y-4 text-sm">

            {/* Título */}
            <div>
              <strong className="block text-lg mb-1">{selected.title}</strong>
              <p className="text-neutral-600 dark:text-slate-300 mb-2">
                {selected.stay?.name || "-"}
                {selected.room?.title ? ` – ${selected.room?.title}` : ""}
              </p>
              <p className="text-neutral-500 dark:text-slate-400 mb-2">
                {selected.type === "preventiva"
                  ? "🗓 Preventiva"
                  : "🧰 Corretiva"}
              </p>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <p className="text-neutral-700 dark:text-slate-200 
                            border rounded-lg p-2 bg-neutral-50 dark:bg-slate-900">
                {selected.description || "Sem descrição"}
              </p>
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-sm font-medium mb-1">Responsável</label>
              <p className="text-neutral-700 dark:text-slate-200 
                            border rounded-lg p-2 bg-neutral-50 dark:bg-slate-900">
                {selected.responsible || "—"}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 
                           bg-white dark:bg-slate-900 
                           border-gray-300 dark:border-slate-700 
                           dark:text-slate-100"
              >
                <option value="pendente">Pendente</option>
                <option value="andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Nova Data (prazo)
              </label>
              {editDate || selected.dueDate ? (
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 
                             bg-white dark:bg-slate-900 
                             border-gray-300 dark:border-slate-700 
                             dark:text-slate-100"
                />
              ) : (
                <p className="text-neutral-700 dark:text-slate-300 
                              border rounded-lg p-2 bg-neutral-50 dark:bg-slate-900">
                  Sem prazo definido
                </p>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                           dark:bg-red-700 dark:hover:bg-red-600 transition"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 border rounded-lg 
                             border-gray-300 dark:border-slate-600 
                             dark:text-slate-200"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg 
                             hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

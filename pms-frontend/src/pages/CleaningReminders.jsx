import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useApi } from "../lib/api";

const emptyPeriodicForm = {
  name: "",
  description: "",
  stayId: "",
  roomIds: [],
  frequency: "CUSTOM_DAYS",
  customIntervalDays: 30,
  active: true,
};

const emptyReminderForm = {
  title: "",
  message: "",
  stayId: "",
  active: false,
  startsAt: null,
  endsAt: null,
};

const emptyActivationForm = {
  mode: "continuous",
  days: 15,
  endsAt: dayjs().add(14, "day").format("YYYY-MM-DD"),
};

const frequencyOptions = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "YEARLY", label: "Anual" },
  { value: "CUSTOM_DAYS", label: "A cada X dias" },
];

function formatDate(value) {
  if (!value) return "-";
  return dayjs(value).format("DD/MM/YYYY");
}

function getActivationWindow(form) {
  const startsAt = dayjs().format("YYYY-MM-DD");
  if (form.mode === "days") {
    const days = Number(form.days) || 1;
    return {
      startsAt,
      endsAt: dayjs().add(days - 1, "day").format("YYYY-MM-DD"),
    };
  }
  if (form.mode === "date") {
    return {
      startsAt,
      endsAt: form.endsAt || startsAt,
    };
  }

  return { startsAt, endsAt: null };
}

function getStatusLabel(active, endsAt) {
  if (!active) return "Inativo";
  if (endsAt) return `Ativo ate ${formatDate(endsAt)}`;
  return "Ativo continuo";
}

export default function CleaningReminders() {
  const api = useApi();
  const [stays, setStays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [periodicTasks, setPeriodicTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [periodicForm, setPeriodicForm] = useState(emptyPeriodicForm);
  const [reminderForm, setReminderForm] = useState(emptyReminderForm);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [activationReminder, setActivationReminder] = useState(null);
  const [activationForm, setActivationForm] = useState(emptyActivationForm);
  const [editingPeriodicId, setEditingPeriodicId] = useState(null);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roomsByStay = useMemo(() => {
    const grouped = {};
    rooms.forEach((room) => {
      const stayId = room.stayId || room.stay?.id || "sem-empreendimento";
      if (!grouped[stayId]) grouped[stayId] = [];
      grouped[stayId].push(room);
    });
    Object.values(grouped).forEach((items) =>
      items.sort((a, b) => String(a.title).localeCompare(String(b.title), "pt-BR"))
    );
    return grouped;
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!periodicForm.stayId) return rooms;
    return roomsByStay[periodicForm.stayId] || [];
  }, [periodicForm.stayId, rooms, roomsByStay]);

  const allFilteredRoomsSelected =
    filteredRooms.length > 0 &&
    filteredRooms.every((room) => periodicForm.roomIds.includes(room.id));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staysRes, roomsRes, periodicRes, remindersRes] = await Promise.all([
        api("/stays"),
        api("/rooms"),
        api("/periodic-tasks"),
        api("/operational-reminders"),
      ]);
      setStays(Array.isArray(staysRes) ? staysRes : []);
      setRooms(Array.isArray(roomsRes) ? roomsRes : []);
      setPeriodicTasks(Array.isArray(periodicRes) ? periodicRes : []);
      setReminders(Array.isArray(remindersRes) ? remindersRes : []);
    } catch (err) {
      console.error("Erro ao carregar lembretes de limpeza:", err);
      setError(err.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetPeriodicForm = () => {
    setEditingPeriodicId(null);
    setPeriodicForm(emptyPeriodicForm);
  };

  const resetReminderForm = () => {
    setEditingReminderId(null);
    setReminderForm(emptyReminderForm);
    setShowReminderModal(false);
  };

  const openNewReminderModal = () => {
    setEditingReminderId(null);
    setReminderForm(emptyReminderForm);
    setShowReminderModal(true);
  };

  const togglePeriodicRoom = (roomId) => {
    setPeriodicForm((prev) => ({
      ...prev,
      roomIds: prev.roomIds.includes(roomId)
        ? prev.roomIds.filter((id) => id !== roomId)
        : [...prev.roomIds, roomId],
    }));
  };

  const toggleAllFilteredRooms = () => {
    setPeriodicForm((prev) => {
      const filteredRoomIds = filteredRooms.map((room) => room.id);
      if (filteredRoomIds.every((id) => prev.roomIds.includes(id))) {
        return {
          ...prev,
          roomIds: prev.roomIds.filter((id) => !filteredRoomIds.includes(id)),
        };
      }
      return {
        ...prev,
        roomIds: [...new Set([...prev.roomIds, ...filteredRoomIds])],
      };
    });
  };

  const handlePeriodicSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (periodicForm.roomIds.length === 0) {
      setError("Selecione pelo menos uma acomodacao.");
      return;
    }

    const basePayload = {
      name: periodicForm.name,
      description: periodicForm.description || null,
      frequency: periodicForm.frequency,
      customIntervalDays:
        periodicForm.frequency === "CUSTOM_DAYS"
          ? Number(periodicForm.customIntervalDays)
          : null,
      active: periodicForm.active,
    };

    try {
      if (editingPeriodicId) {
        await api(`/periodic-tasks/${editingPeriodicId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...basePayload,
            roomId: periodicForm.roomIds[0],
          }),
        });
      } else {
        await Promise.all(
          periodicForm.roomIds.map((roomId) =>
            api("/periodic-tasks", {
              method: "POST",
              body: JSON.stringify({ ...basePayload, roomId }),
            })
          )
        );
      }
      resetPeriodicForm();
      loadData();
    } catch (err) {
      console.error("Erro ao salvar tarefa periodica:", err);
      setError(err.message || "Erro ao salvar tarefa periodica.");
    }
  };

  const handleReminderSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const payload = {
      title: reminderForm.title,
      message: reminderForm.message,
      stayId: reminderForm.stayId,
      active: editingReminderId ? reminderForm.active : false,
      startsAt: editingReminderId ? reminderForm.startsAt : null,
      endsAt: editingReminderId ? reminderForm.endsAt : null,
    };

    try {
      if (editingReminderId) {
        await api(`/operational-reminders/${editingReminderId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/operational-reminders", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetReminderForm();
      loadData();
    } catch (err) {
      console.error("Erro ao salvar lembrete operacional:", err);
      setError(err.message || "Erro ao salvar lembrete operacional.");
    }
  };

  const handleEditPeriodic = (task) => {
    setEditingPeriodicId(task.id);
    setPeriodicForm({
      name: task.name || "",
      description: task.description || "",
      stayId: task.room?.stayId || task.room?.stay?.id || "",
      roomIds: task.roomId ? [task.roomId] : [],
      frequency: task.frequency || "CUSTOM_DAYS",
      customIntervalDays: task.customIntervalDays || 30,
      active: Boolean(task.active),
    });
  };

  const handleEditReminder = (reminder) => {
    setEditingReminderId(reminder.id);
    setReminderForm({
      title: reminder.title || "",
      message: reminder.message || "",
      stayId: reminder.stayId || "",
      active: Boolean(reminder.active),
      startsAt: reminder.startsAt || null,
      endsAt: reminder.endsAt || null,
    });
    setShowReminderModal(true);
  };

  const togglePeriodicTask = async (task) => {
    try {
      await api(`/periodic-tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !task.active }),
      });
      loadData();
    } catch (err) {
      console.error("Erro ao alternar tarefa periodica:", err);
      setError(err.message || "Erro ao alternar tarefa periodica.");
    }
  };

  const openActivationModal = (reminder) => {
    setActivationReminder(reminder);
    setActivationForm(emptyActivationForm);
  };

  const deactivateReminder = async (reminder) => {
    try {
      await api(`/operational-reminders/${reminder.id}`, {
        method: "PUT",
        body: JSON.stringify({
          active: false,
          startsAt: null,
          endsAt: null,
        }),
      });
      loadData();
    } catch (err) {
      console.error("Erro ao alternar lembrete:", err);
      setError(err.message || "Erro ao alternar lembrete.");
    }
  };

  const activateReminder = async (event) => {
    event.preventDefault();
    if (!activationReminder) return;

    try {
      const activationWindow = getActivationWindow(activationForm);
      await api(`/operational-reminders/${activationReminder.id}`, {
        method: "PUT",
        body: JSON.stringify({
          active: true,
          startsAt: activationWindow.startsAt,
          endsAt: activationWindow.endsAt,
        }),
      });
      setActivationReminder(null);
      setActivationForm(emptyActivationForm);
      loadData();
    } catch (err) {
      console.error("Erro ao ativar lembrete:", err);
      setError(err.message || "Erro ao ativar lembrete.");
    }
  };

  const removePeriodicTask = async (task) => {
    if (!confirm(`Remover tarefa periodica "${task.name}"?`)) return;
    try {
      await api(`/periodic-tasks/${task.id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Erro ao remover tarefa periodica:", err);
      setError(err.message || "Erro ao remover tarefa periodica.");
    }
  };

  const removeReminder = async (reminder) => {
    if (!confirm(`Remover lembrete "${reminder.title}"?`)) return;
    try {
      await api(`/operational-reminders/${reminder.id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Erro ao remover lembrete:", err);
      setError(err.message || "Erro ao remover lembrete.");
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lembretes de limpeza</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cadastre tarefas recorrentes por acomodacao e lembretes gerais por empreendimento.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <span className="font-semibold">{periodicTasks.length}</span> recorrentes |{" "}
          <span className="font-semibold">{reminders.length}</span> lembretes
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={20} className="text-sky-700 dark:text-sky-300" />
            <h2 className="text-xl font-semibold">Tarefas periodicas</h2>
          </div>

          <form onSubmit={handlePeriodicSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={periodicForm.name}
                onChange={(e) => setPeriodicForm({ ...periodicForm, name: e.target.value })}
                placeholder="Nome da tarefa"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                required
              />
              <select
                value={periodicForm.stayId}
                onChange={(e) =>
                  setPeriodicForm({ ...periodicForm, stayId: e.target.value, roomIds: [] })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                required
              >
                <option value="">Empreendimento</option>
                {stays.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    {stay.name}
                  </option>
                ))}
              </select>
              <select
                value={periodicForm.frequency}
                onChange={(e) => setPeriodicForm({ ...periodicForm, frequency: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {periodicForm.frequency === "CUSTOM_DAYS" && (
                <input
                  type="number"
                  min="1"
                  value={periodicForm.customIntervalDays}
                  onChange={(e) =>
                    setPeriodicForm({ ...periodicForm, customIntervalDays: e.target.value })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              )}
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={periodicForm.active}
                  onChange={(e) => setPeriodicForm({ ...periodicForm, active: e.target.checked })}
                />
                Ativa
              </label>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Acomodacoes</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {periodicForm.roomIds.length} selecionada(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleAllFilteredRooms}
                  disabled={filteredRooms.length === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
                >
                  {allFilteredRoomsSelected ? "Limpar selecao" : "Selecionar todas"}
                </button>
              </div>
              {filteredRooms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Selecione um empreendimento para listar as acomodacoes.
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {filteredRooms.map((room) => (
                    <label
                      key={room.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={periodicForm.roomIds.includes(room.id)}
                        onChange={() => togglePeriodicRoom(room.id)}
                      />
                      <span>{room.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <textarea
              value={periodicForm.description}
              onChange={(e) =>
                setPeriodicForm({ ...periodicForm, description: e.target.value })
              }
              placeholder="Descricao ou instrucao"
              className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
              >
                {editingPeriodicId ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                {editingPeriodicId
                  ? "Atualizar tarefa"
                  : `Cadastrar em ${periodicForm.roomIds.length || 0} acomodacao(oes)`}
              </button>
              {editingPeriodicId && (
                <button
                  type="button"
                  onClick={resetPeriodicForm}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
            <Bell size={20} className="text-emerald-700 dark:text-emerald-300" />
            <h2 className="text-xl font-semibold">Lembretes estaticos</h2>
            </div>
            <button
              type="button"
              onClick={openNewReminderModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Plus size={16} />
              Novo lembrete
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Os lembretes ficam salvos como modelos inativos. A ativacao continua ou temporaria e feita na lista abaixo.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-xl font-semibold">Tarefas periodicas cadastradas</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : periodicTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhuma tarefa periodica cadastrada.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {periodicTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{task.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {task.room?.stay?.name || "Sem empreendimento"} |{" "}
                      {task.room?.title || "Sem acomodacao"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      task.active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {task.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                {task.description && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {task.description}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-3">
                  <div>Frequencia: {task.frequency === "CUSTOM_DAYS" ? `${task.customIntervalDays} dias` : task.frequency}</div>
                  <div>Ultima: {formatDate(task.lastExecutionDate)}</div>
                  <div>Proxima: {formatDate(task.nextExecutionDate)}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditPeriodic(task)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePeriodicTask(task)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    <Power size={14} />
                    {task.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePeriodicTask(task)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-xl font-semibold">Banco de lembretes estaticos</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : reminders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhum lembrete cadastrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {reminders.map((reminder) => (
              <article
                key={reminder.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{reminder.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {reminder.stay?.name || "Sem empreendimento"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      reminder.active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {getStatusLabel(reminder.active, reminder.endsAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {reminder.message}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditReminder(reminder)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      reminder.active ? deactivateReminder(reminder) : openActivationModal(reminder)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    <Power size={14} />
                    {reminder.active ? "Desativar" : "Ativar"}
                  </button>
                  {!reminder.active && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivationReminder(reminder);
                        setActivationForm({ ...emptyActivationForm, mode: "days" });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                    >
                      <CalendarClock size={14} />
                      Ativar por periodo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeReminder(reminder)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <form
            onSubmit={handleReminderSubmit}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingReminderId ? "Editar lembrete" : "Novo lembrete estatico"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  O lembrete sera salvo no banco e ficara inativo ate ser ativado na lista.
                </p>
              </div>
              <button
                type="button"
                onClick={resetReminderForm}
                className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={reminderForm.title}
                onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                placeholder="Titulo do lembrete"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                required
              />
              <select
                value={reminderForm.stayId}
                onChange={(e) => setReminderForm({ ...reminderForm, stayId: e.target.value })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                required
              >
                <option value="">Empreendimento</option>
                {stays.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    {stay.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={reminderForm.message}
              onChange={(e) => setReminderForm({ ...reminderForm, message: e.target.value })}
              placeholder="Mensagem enviada na listagem das diaristas"
              className="mt-3 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={resetReminderForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                {editingReminderId ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                {editingReminderId ? "Atualizar lembrete" : "Cadastrar lembrete"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activationReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <form
            onSubmit={activateReminder}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Ativar lembrete</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activationReminder.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivationReminder(null)}
                className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="activationMode"
                  checked={activationForm.mode === "continuous"}
                  onChange={() =>
                    setActivationForm({ ...activationForm, mode: "continuous" })
                  }
                />
                Ativar por tempo indeterminado
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="activationMode"
                  checked={activationForm.mode === "days"}
                  onChange={() => setActivationForm({ ...activationForm, mode: "days" })}
                />
                Ativar por quantidade de dias
              </label>
              {activationForm.mode === "days" && (
                <input
                  type="number"
                  min="1"
                  value={activationForm.days}
                  onChange={(e) =>
                    setActivationForm({ ...activationForm, days: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              )}
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="activationMode"
                  checked={activationForm.mode === "date"}
                  onChange={() => setActivationForm({ ...activationForm, mode: "date" })}
                />
                Ativar ate uma data
              </label>
              {activationForm.mode === "date" && (
                <input
                  type="date"
                  value={activationForm.endsAt}
                  onChange={(e) =>
                    setActivationForm({ ...activationForm, endsAt: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivationReminder(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <Power size={16} />
                Ativar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

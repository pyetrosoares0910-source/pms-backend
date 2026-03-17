import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptLocale from "@fullcalendar/core/locales/pt-br";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useApi } from "../lib/api";
import { buildMaintenanceAlert, getMaintenanceAlertSummary } from "./maintenanceShared";

dayjs.extend(utc);

const STATUS_OPTIONS = [
  { value: "", label: "Status (todos)" },
  { value: "pendente", label: "Pendente" },
  { value: "andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluido" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Tipo (todos)" },
  { value: "corretiva", label: "Corretiva" },
  { value: "preventiva", label: "Preventiva" },
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function buildEmptyForm(dueDate = "") {
  return {
    title: "",
    description: "",
    stayId: "",
    roomId: "",
    responsible: "",
    status: "pendente",
    type: "corretiva",
    dueDate,
  };
}

function sortStays(a, b) {
  const posDiff = (a?.position ?? 9999) - (b?.position ?? 9999);
  if (posDiff !== 0) return posDiff;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR");
}

function sortRooms(a, b) {
  const stayDiff = sortStays(a?.stay || {}, b?.stay || {});
  if (stayDiff !== 0) return stayDiff;
  const roomPosDiff = (a?.position ?? 9999) - (b?.position ?? 9999);
  if (roomPosDiff !== 0) return roomPosDiff;
  return String(a?.title || "").localeCompare(String(b?.title || ""), "pt-BR");
}

function formatDisplayDate(value) {
  if (!value) return "-";
  return dayjs.utc(value).format("DD/MM/YYYY");
}

function getDueDay(task) {
  return task?.dueDate ? dayjs.utc(task.dueDate).startOf("day") : null;
}

function isTaskCompleted(task) {
  return String(task?.status || "").toLowerCase() === "concluido";
}

function isTaskActive(task) {
  return !isTaskCompleted(task);
}

function isTaskOverdue(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isBefore(referenceDate, "day");
}

function isTaskDueToday(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isSame(referenceDate, "day");
}

function buildTaskPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    stayId: form.stayId || null,
    roomId: form.roomId || null,
    responsible: form.responsible.trim() || null,
    status: form.status,
    type: form.type,
    dueDate: form.dueDate || null,
  };
}

function mapTaskToForm(task) {
  return {
    title: task?.title || "",
    description: task?.description || "",
    stayId: task?.stayId || task?.stay?.id || "",
    roomId: task?.roomId || task?.room?.id || "",
    responsible: task?.responsible || "",
    status: task?.status || "pendente",
    type: task?.type || "corretiva",
    dueDate: task?.dueDate ? dayjs.utc(task.dueDate).format("YYYY-MM-DD") : "",
  };
}

function applyTaskFieldChange(current, field, value, roomMap) {
  const next = { ...current, [field]: value };

  if (field === "stayId") {
    const activeRoom = roomMap.get(current.roomId);
    if (activeRoom && activeRoom.stayId !== value) {
      next.roomId = "";
    }
  }

  if (field === "roomId") {
    const room = roomMap.get(value);
    if (room?.stayId) {
      next.stayId = room.stayId;
    }
  }

  return next;
}

function getEventTone(task, referenceDate) {
  if (isTaskCompleted(task)) {
    return {
      backgroundColor: "#10B981",
      borderColor: "#059669",
      textColor: "#FFFFFF",
    };
  }

  if (isTaskOverdue(task, referenceDate)) {
    return {
      backgroundColor: "#FEE2E2",
      borderColor: "#F87171",
      textColor: "#9F1239",
    };
  }

  if (isTaskDueToday(task, referenceDate)) {
    return {
      backgroundColor: "#FEF3C7",
      borderColor: "#F59E0B",
      textColor: "#92400E",
    };
  }

  if (String(task?.status || "").toLowerCase() === "andamento") {
    return {
      backgroundColor: "#DBEAFE",
      borderColor: "#60A5FA",
      textColor: "#1D4ED8",
    };
  }

  if (String(task?.type || "").toLowerCase() === "preventiva") {
    return {
      backgroundColor: "#E2E8F0",
      borderColor: "#94A3B8",
      textColor: "#334155",
    };
  }

  return {
    backgroundColor: "#E0F2FE",
    borderColor: "#38BDF8",
    textColor: "#0369A1",
  };
}

function Modal({ open, onClose, title, subtitle, children, maxWidthClass = "max-w-4xl" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cx(
          "relative w-full overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.24)] dark:border-slate-700/70 dark:bg-slate-950 dark:shadow-[0_35px_110px_rgba(0,0,0,0.55)]",
          maxWidthClass
        )}
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10" />

        <div className="relative border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, helper, tone, icon: Icon }) {
  const toneMap = {
    sky: {
      shell:
        "border-sky-200 bg-gradient-to-br from-white via-sky-50 to-sky-100/70 dark:border-sky-900/50 dark:from-slate-950 dark:via-sky-950/30 dark:to-slate-950",
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      value: "text-sky-700 dark:text-sky-300",
    },
    rose: {
      shell:
        "border-rose-200 bg-gradient-to-br from-white via-rose-50 to-rose-100/70 dark:border-rose-900/50 dark:from-slate-950 dark:via-rose-950/25 dark:to-slate-950",
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      value: "text-rose-700 dark:text-rose-300",
    },
    emerald: {
      shell:
        "border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-emerald-100/70 dark:border-emerald-900/50 dark:from-slate-950 dark:via-emerald-950/25 dark:to-slate-950",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    slate: {
      shell:
        "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
      icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-700 dark:text-slate-200",
    },
  };

  const style = toneMap[tone] || toneMap.slate;

  return (
    <article className={cx("rounded-[28px] border p-5 shadow-sm", style.shell)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {title}
          </div>
          <div className={cx("mt-3 text-3xl font-black tracking-[-0.04em]", style.value)}>{value}</div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
        </div>

        <div className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", style.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function TaskForm({
  form,
  stays,
  rooms,
  onFieldChange,
  onSubmit,
  submitLabel,
  isSubmitting,
  onCancel,
  footerLeft,
}) {
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Titulo</label>
          <input
            value={form.title}
            onChange={(e) => onFieldChange("title", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            required
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descricao</label>
          <textarea
            value={form.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empreendimento</label>
          <select
            value={form.stayId}
            onChange={(e) => onFieldChange("stayId", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Selecione...</option>
            {stays.map((stay) => (
              <option key={stay.id} value={stay.id}>
                {stay.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Unidade / local</label>
          <select
            value={form.roomId}
            onChange={(e) => onFieldChange("roomId", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Nao vincular</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.stay?.name ? `${room.stay.name} - ` : ""}
                {room.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Responsavel</label>
          <input
            value={form.responsible}
            onChange={(e) => onFieldChange("responsible", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prazo</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => onFieldChange("dueDate", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
          <select
            value={form.status}
            onChange={(e) => onFieldChange("status", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => onFieldChange("type", e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {TYPE_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <div className="flex flex-wrap gap-3">{footerLeft}</div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            {isSubmitting ? "Salvando..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function MaintenanceCalendar() {
  const api = useApi();
  const referenceDate = useMemo(() => dayjs().startOf("day"), []);

  const [tasks, setTasks] = useState([]);
  const [stays, setStays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(buildEmptyForm(dayjs().format("YYYY-MM-DD")));
  const [savingCreate, setSavingCreate] = useState(false);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(buildEmptyForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const orderedStays = useMemo(() => [...stays].sort(sortStays), [stays]);
  const orderedRooms = useMemo(() => [...rooms].sort(sortRooms), [rooms]);
  const roomMap = useMemo(
    () => new Map(orderedRooms.map((room) => [room.id, room])),
    [orderedRooms]
  );
  const roomsForCreate = useMemo(
    () => orderedRooms.filter((room) => !createForm.stayId || room.stayId === createForm.stayId),
    [createForm.stayId, orderedRooms]
  );
  const roomsForEdit = useMemo(
    () => orderedRooms.filter((room) => !editForm.stayId || room.stayId === editForm.stayId),
    [editForm.stayId, orderedRooms]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [tasksResponse, staysResponse, roomsResponse] = await Promise.all([
          api("/maintenance"),
          api("/stays"),
          api("/rooms"),
        ]);

        setTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
        setStays(Array.isArray(staysResponse) ? staysResponse : []);
        setRooms(Array.isArray(roomsResponse) ? roomsResponse : []);
      } catch (err) {
        console.error("Erro ao carregar agenda de manutencao:", err);
        alert(err?.message || "Erro ao carregar agenda de manutencao.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadData = useCallback(async () => {
    await loadData({ silent: true });
  }, [loadData]);

  const scheduledTasks = useMemo(
    () => tasks.filter((task) => Boolean(task.dueDate)),
    [tasks]
  );
  const unscheduledTasks = useMemo(
    () =>
      [...tasks.filter((task) => !task.dueDate)].sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "pt-BR")
      ),
    [tasks]
  );
  const overallSummary = useMemo(
    () => getMaintenanceAlertSummary(tasks, referenceDate),
    [tasks, referenceDate]
  );
  const maintenanceAlert = useMemo(
    () => buildMaintenanceAlert(overallSummary),
    [overallSummary]
  );

  const events = useMemo(
    () =>
      scheduledTasks.map((task) => {
        const tone = getEventTone(task, referenceDate);
        const start = dayjs.utc(task.dueDate).format("YYYY-MM-DD");

        return {
          id: task.id,
          title: task.title,
          start,
          allDay: true,
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
          textColor: tone.textColor,
          extendedProps: {
            task,
          },
        };
      }),
    [referenceDate, scheduledTasks]
  );

  const openCreateModal = useCallback((dueDate = dayjs().format("YYYY-MM-DD")) => {
    setCreateForm(buildEmptyForm(dueDate));
    setCreateOpen(true);
  }, []);

  const openEditModal = useCallback((task) => {
    setSelected(task);
    setEditForm(mapTaskToForm(task));
  }, []);

  const closeEditModal = useCallback(() => {
    setSelected(null);
    setEditForm(buildEmptyForm());
  }, []);

  const handleCreateFieldChange = useCallback(
    (field, value) => {
      setCreateForm((current) => applyTaskFieldChange(current, field, value, roomMap));
    },
    [roomMap]
  );

  const handleEditFieldChange = useCallback(
    (field, value) => {
      setEditForm((current) => applyTaskFieldChange(current, field, value, roomMap));
    },
    [roomMap]
  );

  const handleCreate = useCallback(
    async (event) => {
      event.preventDefault();

      if (!createForm.title.trim()) {
        alert("Informe um titulo para a atividade.");
        return;
      }

      try {
        setSavingCreate(true);
        await api("/maintenance", {
          method: "POST",
          body: JSON.stringify({
            ...buildTaskPayload(createForm),
            isRecurring: false,
            recurrence: null,
          }),
        });

        setCreateOpen(false);
        setCreateForm(buildEmptyForm(dayjs().format("YYYY-MM-DD")));
        await reloadData();
      } catch (err) {
        console.error("Erro ao criar atividade simples:", err);
        alert(err?.message || "Erro ao criar atividade.");
      } finally {
        setSavingCreate(false);
      }
    },
    [api, createForm, reloadData]
  );

  const handleUpdate = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selected) return;

      try {
        setSavingEdit(true);
        await api(`/maintenance/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(buildTaskPayload(editForm)),
        });

        closeEditModal();
        await reloadData();
      } catch (err) {
        console.error("Erro ao atualizar tarefa:", err);
        alert(err?.message || "Erro ao atualizar tarefa.");
      } finally {
        setSavingEdit(false);
      }
    },
    [api, closeEditModal, editForm, reloadData, selected]
  );

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`Excluir a atividade "${selected.title}"?`)) return;

    try {
      setDeletingId(selected.id);
      await api(`/maintenance/${selected.id}`, { method: "DELETE" });
      closeEditModal();
      await reloadData();
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
      alert(err?.message || "Erro ao excluir tarefa.");
    } finally {
      setDeletingId("");
    }
  }, [api, closeEditModal, reloadData, selected]);

  const handleEventDrop = useCallback(
    async (info) => {
      const task = info.event.extendedProps.task;
      if (!task) {
        info.revert();
        return;
      }

      const nextDate = dayjs(info.event.start).format("YYYY-MM-DD");

      try {
        await api(`/maintenance/${task.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...buildTaskPayload(mapTaskToForm(task)),
            dueDate: nextDate,
          }),
        });

        await reloadData();
      } catch (err) {
        info.revert();
        console.error("Erro ao mover tarefa no calendario:", err);
        alert(err?.message || "Erro ao atualizar a data da atividade.");
      }
    },
    [api, reloadData]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <div className="mx-auto max-w-7xl space-y-5">

        {!loading ? (
          <div
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              maintenanceAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            )}
          >
            {maintenanceAlert.message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <StatCard
            title="Em aberto"
            value={overallSummary.active}
            helper="Itens ativos no recorte atual."
            tone="sky"
            icon={Clock3}
          />
          <StatCard
            title="Atrasadas"
            value={overallSummary.overdue}
            helper="Ja passaram do prazo."
            tone="rose"
            icon={AlertTriangle}
          />
          <StatCard
            title="Vencem hoje"
            value={overallSummary.dueToday}
            helper="Entram na operacao do dia."
            tone="emerald"
            icon={CalendarClock}
          />
          <StatCard
            title="Concluidas"
            value={overallSummary.completed}
            helper="Ja finalizadas neste recorte."
            tone="slate"
            icon={CheckCircle2}
          />
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-sky-600 dark:text-sky-400" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Carregando agenda de manutencao...
            </p>
          </div>
        ) : (
          <section className="rounded-[32px] border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 lg:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                  Calendario de manutencao
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Clique em um dia para inserir uma atividade simples, arraste eventos para remarcar e clique para editar.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnscheduledOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Wrench className="h-4 w-4" />
                  Sem prazo {unscheduledTasks.length > 0 ? `(${unscheduledTasks.length})` : ""}
                </button>

                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <Plus className="h-4 w-4" />
                  Inserir atividade
                </button>

                <button
                  type="button"
                  onClick={reloadData}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <RefreshCw className={cx("h-4 w-4", refreshing ? "animate-spin" : "")} />
                  Atualizar
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                Pendente
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Em andamento
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Vence hoje
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Atrasada
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Concluida
              </span>
            </div>

            <div
              className={cx(
                "rounded-[28px] border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950",
                "[&_.fc]:font-sans",
                "[&_.fc-toolbar]:mb-5 [&_.fc-toolbar]:flex-wrap [&_.fc-toolbar]:gap-3",
                "[&_.fc-toolbar-title]:text-2xl [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar-title]:tracking-[-0.03em] [&_.fc-toolbar-title]:text-slate-900 dark:[&_.fc-toolbar-title]:text-slate-100",
                "[&_.fc-button]:rounded-2xl [&_.fc-button]:border-0 [&_.fc-button]:bg-slate-900 [&_.fc-button]:px-3.5 [&_.fc-button]:py-2 [&_.fc-button]:text-sm [&_.fc-button]:font-semibold [&_.fc-button]:shadow-none [&_.fc-button]:transition [&_.fc-button:hover]:bg-slate-800 dark:[&_.fc-button]:bg-slate-200 dark:[&_.fc-button]:text-slate-950 dark:[&_.fc-button:hover]:bg-white",
                "[&_.fc-button-primary.fc-button-active]:bg-sky-700 dark:[&_.fc-button-primary.fc-button-active]:bg-sky-500",
                "[&_.fc-button-group]:overflow-hidden [&_.fc-button-group]:rounded-2xl",
                "[&_.fc-scrollgrid]:overflow-hidden [&_.fc-scrollgrid]:rounded-[24px] [&_.fc-scrollgrid]:border [&_.fc-scrollgrid]:border-slate-200 dark:[&_.fc-scrollgrid]:border-slate-800",
                "[&_.fc-theme-standard_td]:border-slate-100 dark:[&_.fc-theme-standard_td]:border-slate-800",
                "[&_.fc-theme-standard_th]:border-slate-100 dark:[&_.fc-theme-standard_th]:border-slate-800",
                "[&_.fc-col-header-cell]:bg-slate-50/80 dark:[&_.fc-col-header-cell]:bg-slate-950/50",
                "[&_.fc-col-header-cell-cushion]:px-2 [&_.fc-col-header-cell-cushion]:py-4 [&_.fc-col-header-cell-cushion]:text-[11px] [&_.fc-col-header-cell-cushion]:font-semibold [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-col-header-cell-cushion]:tracking-[0.18em] [&_.fc-col-header-cell-cushion]:text-slate-400",
                "[&_.fc-daygrid-day-frame]:min-h-[120px]",
                "[&_.fc-daygrid-day-top]:px-2 [&_.fc-daygrid-day-top]:pt-2",
                "[&_.fc-daygrid-day-number]:text-sm [&_.fc-daygrid-day-number]:font-semibold [&_.fc-daygrid-day-number]:text-slate-500 dark:[&_.fc-daygrid-day-number]:text-slate-300",
                "[&_.fc-daygrid-day.fc-day-today]:bg-sky-50/60 dark:[&_.fc-daygrid-day.fc-day-today]:bg-sky-950/20",
                "[&_.fc-daygrid-more-link]:rounded-full [&_.fc-daygrid-more-link]:bg-slate-100 [&_.fc-daygrid-more-link]:px-2.5 [&_.fc-daygrid-more-link]:py-1 [&_.fc-daygrid-more-link]:text-[11px] [&_.fc-daygrid-more-link]:font-semibold [&_.fc-daygrid-more-link]:text-slate-600 dark:[&_.fc-daygrid-more-link]:bg-slate-800 dark:[&_.fc-daygrid-more-link]:text-slate-200",
                "[&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-2xl [&_.fc-event]:border [&_.fc-event]:shadow-none",
                "[&_.fc-event-main]:p-0",
                "[&_.fc-timegrid-axis-cushion]:text-xs [&_.fc-timegrid-slot-label-cushion]:text-xs"
              )}
            >
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale={ptLocale}
                height="76vh"
                editable
                eventStartEditable
                fixedWeekCount={false}
                moreLinkClick="popover"
                dayMaxEvents={4}
                timeZone="local"
                nowIndicator
                stickyHeaderDates
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                buttonText={{
                  today: "Hoje",
                  month: "Mes",
                  week: "Semana",
                  day: "Dia",
                }}
                events={events}
                dateClick={(info) => openCreateModal(info.dateStr)}
                eventClick={(info) => openEditModal(info.event.extendedProps.task)}
                eventDrop={handleEventDrop}
                eventDidMount={(info) => {
                  const task = info.event.extendedProps.task;
                  info.el.title = [
                    task?.title,
                    task?.room?.title || task?.stay?.name,
                    task?.responsible,
                    task?.dueDate ? formatDisplayDate(task.dueDate) : "Sem prazo",
                    task?.status,
                  ]
                    .filter(Boolean)
                    .join(" | ");
                }}
                eventContent={(info) => {
                  const task = info.event.extendedProps.task;
                  const detail =
                    task.room?.title || task.responsible || task.stay?.name || "Sem detalhe";
                  const statusNote = isTaskOverdue(task, referenceDate)
                    ? "Atrasada"
                    : isTaskDueToday(task, referenceDate)
                      ? "Hoje"
                      : task.status === "concluido"
                        ? "OK"
                        : task.type === "preventiva"
                          ? "Prev."
                          : "";

                  return (
                    <div className="w-full overflow-hidden rounded-xl px-2.5 py-2">
                      <div className="truncate text-[11px] font-semibold leading-4">{task.title}</div>
                      <div className="mt-1 truncate text-[10px] leading-4 opacity-80">{detail}</div>
                      {statusNote ? (
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-75">
                          {statusNote}
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
            </div>
          </section>
        )}
      </div>

      <Modal
        open={unscheduledOpen}
        onClose={() => setUnscheduledOpen(false)}
        title="Atividades sem prazo"
        subtitle="Itens que ainda nao entraram no calendario porque nao possuem data definida."
      >
        <div className="space-y-4">
          {unscheduledTasks.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nenhuma atividade sem prazo no momento.
            </div>
          ) : (
            unscheduledTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {task.code || "Sem codigo"}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {task.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {task.description || "Sem descricao informada."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUnscheduledOpen(false);
                      openEditModal(task);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Building2 className="h-3.5 w-3.5" />
                      Empreendimento
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {task.stay?.name || "Sem empreendimento"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <UserRound className="h-3.5 w-3.5" />
                      Responsavel
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {task.responsible || "Nao definido"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Prazo
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Sem prazo definido
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova atividade simples"
        subtitle="Cadastro rapido, sem configuracao de recorrencia."
      >
        <TaskForm
          form={createForm}
          stays={orderedStays}
          rooms={roomsForCreate}
          onFieldChange={handleCreateFieldChange}
          onSubmit={handleCreate}
          submitLabel="Salvar atividade"
          isSubmitting={savingCreate}
          onCancel={() => setCreateOpen(false)}
          footerLeft={
            createForm.dueDate ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                Prazo selecionado: {formatDisplayDate(createForm.dueDate)}
              </div>
            ) : null
          }
        />
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={closeEditModal}
        title="Editar atividade"
        subtitle="Atualize prazo, status, local, responsavel e demais campos direto pela agenda."
      >
        {selected ? (
          <TaskForm
            form={editForm}
            stays={orderedStays}
            rooms={roomsForEdit}
            onFieldChange={handleEditFieldChange}
            onSubmit={handleUpdate}
            submitLabel="Salvar alteracoes"
            isSubmitting={savingEdit}
            onCancel={closeEditModal}
            footerLeft={
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  Codigo: {selected.code}
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletingId === selected.id}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingId === selected.id ? "Excluindo..." : "Excluir"}
                </button>
              </>
            }
          />
        ) : null}
      </Modal>
    </div>
  );
}

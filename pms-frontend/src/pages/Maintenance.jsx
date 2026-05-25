import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Filter,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useApi } from "../lib/api";
import { buildMaintenanceAlert } from "./maintenanceShared";

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

const RECURRENCE_MODE_OPTIONS = [
  { value: "monthly_by_day", label: "Mensal (dia fixo)" },
  { value: "monthly_twice", label: "Mensal (2x no mes)" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "weekly", label: "Semanal" },
  { value: "yearly_firstWeek", label: "Anual (1a semana)" },
];

const DATE_PRESET_OPTIONS = [
  { value: "all", label: "Tudo" },
  { value: "overdue", label: "Atrasadas" },
  { value: "today", label: "Hoje" },
  { value: "next7", label: "Prox. 7 dias" },
  { value: "thisMonth", label: "Este mes" },
  { value: "no_date", label: "Sem prazo" },
  { value: "custom", label: "Periodo" },
];

const WEEKDAY_OPTIONS = [
  { value: "MO", label: "Seg" },
  { value: "TU", label: "Ter" },
  { value: "WE", label: "Qua" },
  { value: "TH", label: "Qui" },
  { value: "FR", label: "Sex" },
  { value: "SA", label: "Sab" },
  { value: "SU", label: "Dom" },
];

const FOCUS_LABELS = {
  all: "Tudo",
  open: "Em aberto",
  overdue: "Atrasadas",
  dueToday: "Vencem hoje",
  completed: "Concluidas",
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function buildEmptyForm() {
  return {
    title: "",
    description: "",
    stayId: "",
    roomId: "",
    responsible: "",
    status: "pendente",
    type: "corretiva",
    dueDate: "",
    isRecurring: false,
    recurrence: {
      mode: "monthly_by_day",
      days: [],
      weekdays: [],
      months: [],
      startDate: "",
      anchor: "",
    },
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseNumberList(value, { min, max }) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= min && item <= max)
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((a, b) => a - b);
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
  return !task?.isRecurring && !isTaskCompleted(task);
}

function isTaskOverdue(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isBefore(referenceDate, "day");
}

function isTaskDueToday(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isSame(referenceDate, "day");
}

function isTaskDueWithinDays(task, referenceDate, days) {
  const due = getDueDay(task);
  if (!isTaskActive(task) || !due) return false;
  return !due.isBefore(referenceDate, "day") && !due.isAfter(referenceDate.add(days, "day"), "day");
}

function getStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "concluido") {
    return {
      label: "Concluido",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }
  if (normalized === "andamento") {
    return {
      label: "Em andamento",
      badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    };
  }
  return {
    label: "Pendente",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  };
}

function getTypeMeta(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "preventiva") {
    return {
      label: "Preventiva",
      badge: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };
  }
  return {
    label: "Corretiva",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
}

function formatRecurrence(recurrence) {
  if (!recurrence?.mode) return "Sem configuracao";

  const weekdayMap = WEEKDAY_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

  const formatWeekdays = (values) =>
    (values || []).map((value) => weekdayMap[value] || value).join(", ");

  const formatMonths = (values) =>
    (values || [])
      .map((value) => dayjs().month(Number(value) - 1).format("MMM"))
      .join(", ");

  switch (recurrence.mode) {
    case "monthly_by_day":
      return `Mensal nos dias ${(recurrence.days || []).join(", ") || "-"}`;
    case "monthly_twice":
      return `Mensal 2x no mes (${(recurrence.days || []).join(", ") || "-"})`;
    case "biweekly":
      return `Quinzenal a partir de ${formatDisplayDate(recurrence.anchor || recurrence.startDate)}`;
    case "weekly":
      return `Semanal em ${formatWeekdays(recurrence.weekdays) || "dias nao definidos"}`;
    case "yearly_firstWeek":
      return `Anual na 1a semana de ${formatMonths(recurrence.months) || "-"} (${formatWeekdays(
        recurrence.weekdays
      ) || "-"})`;
    default:
      return recurrence.mode;
  }
}

function buildTaskSearchBlob(task) {
  return normalizeText(
    [
      task.code,
      task.title,
      task.description,
      task.stay?.name,
      task.room?.title,
      task.responsible,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function matchesDatePreset(task, filters, referenceDate) {
  const due = getDueDay(task);

  if (filters.datePreset === "custom") {
    if (filters.dateFrom && (!due || due.isBefore(dayjs.utc(filters.dateFrom), "day"))) {
      return false;
    }
    if (filters.dateTo && (!due || due.isAfter(dayjs.utc(filters.dateTo), "day"))) {
      return false;
    }
    return true;
  }

  switch (filters.datePreset) {
    case "overdue":
      return isTaskOverdue(task, referenceDate);
    case "today":
      return Boolean(due) && due.isSame(referenceDate, "day");
    case "next7":
      return Boolean(due) && !due.isBefore(referenceDate, "day") && !due.isAfter(referenceDate.add(7, "day"), "day");
    case "thisMonth":
      return Boolean(due) && due.isSame(referenceDate, "month");
    case "no_date":
      return !due;
    default:
      return true;
  }
}

function sortTasksByDate(items, direction = "asc") {
  return [...items].sort((a, b) => {
    const dateA = getDueDay(a);
    const dateB = getDueDay(b);

    if (dateA && dateB) {
      return direction === "asc" ? dateA.valueOf() - dateB.valueOf() : dateB.valueOf() - dateA.valueOf();
    }
    if (dateA) return -1;
    if (dateB) return 1;

    const fallbackA = dayjs.utc(a.updatedAt || a.createdAt).valueOf();
    const fallbackB = dayjs.utc(b.updatedAt || b.createdAt).valueOf();
    return direction === "asc" ? fallbackA - fallbackB : fallbackB - fallbackA;
  });
}

function getDueTone(task, referenceDate) {
  if (task.isRecurring) {
    return {
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      label: formatRecurrence(task.recurrence),
    };
  }

  if (!task.dueDate) {
    return {
      badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      label: "Sem prazo definido",
    };
  }

  const due = getDueDay(task);
  if (isTaskCompleted(task)) {
    return {
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      label: `Prazo ${formatDisplayDate(task.dueDate)}`,
    };
  }

  if (due.isBefore(referenceDate, "day")) {
    const diff = referenceDate.diff(due, "day");
    return {
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
      label: `Atrasada ${diff} dia(s)`,
    };
  }

  if (due.isSame(referenceDate, "day")) {
    return {
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      label: "Vence hoje",
    };
  }

  const diff = due.diff(referenceDate, "day");
  return {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    label: diff === 1 ? "Vence amanha" : `Vence em ${diff} dias`,
  };
}

function sanitizeRecurrence(form) {
  const recurrence = form.recurrence || {};
  const startDate = recurrence.startDate || form.dueDate || dayjs().format("YYYY-MM-DD");
  const start = dayjs(startDate);
  const defaultWeekday = WEEKDAY_OPTIONS[start.day() === 0 ? 6 : start.day() - 1]?.value || "MO";

  switch (recurrence.mode) {
    case "monthly_by_day":
    case "monthly_twice":
      return {
        mode: recurrence.mode,
        startDate,
        days: recurrence.days?.length ? recurrence.days : [start.date()],
      };
    case "biweekly":
      return {
        mode: "biweekly",
        startDate,
        anchor: recurrence.anchor || startDate,
      };
    case "weekly":
      return {
        mode: "weekly",
        startDate,
        weekdays: recurrence.weekdays?.length ? recurrence.weekdays : [defaultWeekday],
        interval: 1,
      };
    case "yearly_firstWeek":
      return {
        mode: "yearly_firstWeek",
        startDate,
        weekdays: recurrence.weekdays?.length ? recurrence.weekdays : [defaultWeekday],
        months: recurrence.months?.length ? recurrence.months : [start.month() + 1],
      };
    default:
      return {
        mode: "monthly_by_day",
        startDate,
        days: [start.date()],
      };
  }
}

function mapTaskToForm(task) {
  const base = buildEmptyForm();
  return {
    ...base,
    title: task?.title || "",
    description: task?.description || "",
    stayId: task?.stayId || task?.stay?.id || "",
    roomId: task?.roomId || task?.room?.id || "",
    responsible: task?.responsible || "",
    status: task?.status || "pendente",
    type: task?.type || "corretiva",
    dueDate: task?.dueDate ? dayjs.utc(task.dueDate).format("YYYY-MM-DD") : "",
    isRecurring: Boolean(task?.isRecurring),
    recurrence: {
      ...base.recurrence,
      ...(task?.recurrence || {}),
      days: Array.isArray(task?.recurrence?.days) ? task.recurrence.days : [],
      weekdays: Array.isArray(task?.recurrence?.weekdays) ? task.recurrence.weekdays : [],
      months: Array.isArray(task?.recurrence?.months) ? task.recurrence.months : [],
      startDate: task?.recurrence?.startDate
        ? dayjs(task.recurrence.startDate).format("YYYY-MM-DD")
        : "",
      anchor: task?.recurrence?.anchor ? dayjs(task.recurrence.anchor).format("YYYY-MM-DD") : "",
    },
  };
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
    isRecurring: form.isRecurring,
    recurrence: form.isRecurring ? sanitizeRecurrence(form) : null,
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

  if (field === "isRecurring" && value && !current.recurrence.startDate) {
    next.recurrence = {
      ...current.recurrence,
      startDate: current.dueDate || dayjs().format("YYYY-MM-DD"),
      anchor: current.recurrence.anchor || current.dueDate || dayjs().format("YYYY-MM-DD"),
    };
  }

  return next;
}

function applyRecurrenceFieldChange(current, field, value) {
  const nextRecurrence = {
    ...current.recurrence,
    [field]: value,
  };

  if (field === "startDate") {
    if (
      !current.recurrence.anchor ||
      current.recurrence.anchor === current.recurrence.startDate
    ) {
      nextRecurrence.anchor = value;
    }
  }

  if (field === "mode") {
    const referenceDate =
      nextRecurrence.startDate || current.dueDate || dayjs().format("YYYY-MM-DD");
    const referenceDay = dayjs(referenceDate);
    const defaultWeekday =
      WEEKDAY_OPTIONS[referenceDay.day() === 0 ? 6 : referenceDay.day() - 1]
        ?.value || "MO";

    if (value === "biweekly" && !nextRecurrence.anchor) {
      nextRecurrence.anchor = referenceDate;
    }

    if ((value === "weekly" || value === "yearly_firstWeek") && !nextRecurrence.weekdays?.length) {
      nextRecurrence.weekdays = [defaultWeekday];
    }
  }

  return {
    ...current,
    recurrence: nextRecurrence,
  };
}

function Modal({ open, onClose, title, subtitle, children, maxWidthClass = "max-w-5xl" }) {
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

function SummaryCard({ title, value, helper, tone, icon: Icon, active = false, onClick }) {
  const toneMap = {
    sky: {
      shell: "border-sky-200 bg-gradient-to-br from-white via-sky-50 to-sky-100/70 dark:border-sky-900/50 dark:from-slate-950 dark:via-sky-950/30 dark:to-slate-950",
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      value: "text-sky-700 dark:text-sky-300",
    },
    rose: {
      shell: "border-rose-200 bg-gradient-to-br from-white via-rose-50 to-rose-100/70 dark:border-rose-900/50 dark:from-slate-950 dark:via-rose-950/25 dark:to-slate-950",
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      value: "text-rose-700 dark:text-rose-300",
    },
    emerald: {
      shell: "border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-emerald-100/70 dark:border-emerald-900/50 dark:from-slate-950 dark:via-emerald-950/25 dark:to-slate-950",
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    slate: {
      shell: "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
      icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      value: "text-slate-700 dark:text-slate-200",
    },
  };

  const style = toneMap[tone] || toneMap.slate;
  const Component = onClick ? "button" : "article";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "rounded-[28px] border p-5 shadow-sm",
        style.shell,
        onClick
          ? "w-full text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500/60 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-sky-400/60 dark:focus:ring-offset-slate-950"
          : "",
        active ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-gray-50 dark:ring-sky-400 dark:ring-offset-slate-950" : ""
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {title}
          </div>
          <div className={cx("mt-3 text-3xl font-black tracking-[-0.04em]", style.value)}>{value}</div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
          {onClick ? (
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {active ? "Filtro ativo" : "Clique para filtrar"}
            </div>
          ) : null}
        </div>

        <div className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", style.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Component>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition",
        active
          ? "border-sky-700 bg-sky-700 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function TaskCard({ task, referenceDate, onEdit, onGenerate, generatingId }) {
  const statusMeta = getStatusMeta(task.status);
  const typeMeta = getTypeMeta(task.type);
  const dueMeta = getDueTone(task, referenceDate);

  const shellClass = task.isRecurring
    ? "border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-white dark:border-emerald-900/40 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950"
    : isTaskCompleted(task)
      ? "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      : isTaskOverdue(task, referenceDate)
        ? "border-rose-200 bg-gradient-to-br from-white via-rose-50 to-white dark:border-rose-900/40 dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-950"
        : "border-sky-200 bg-gradient-to-br from-white via-sky-50 to-white dark:border-sky-900/40 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-950";

  return (
    <article className={cx("rounded-[28px] border p-5 shadow-sm", shellClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {task.code}
            </span>
            <span className={cx("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", statusMeta.badge)}>
              {statusMeta.label}
            </span>
            <span className={cx("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", typeMeta.badge)}>
              {typeMeta.label}
            </span>
            {task.isRecurring ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Modelo experimental
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {task.description || "Sem descricao informada."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
            Empreendimento
          </div>
          <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {task.stay?.name || "Sem empreendimento"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Wrench className="h-3.5 w-3.5" />
            UH / Local
          </div>
          <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {task.room?.title || "Nao vinculado"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <UserRound className="h-3.5 w-3.5" />
            Responsavel
          </div>
          <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {task.responsible || "Nao definido"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            Prazo / Regra
          </div>
          <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {task.dueDate ? formatDisplayDate(task.dueDate) : task.isRecurring ? "Modelo recorrente" : "Sem prazo"}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", dueMeta.badge)}>{dueMeta.label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Atualizada em {formatDisplayDate(task.updatedAt || task.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {task.isRecurring ? (
            <button
              type="button"
              onClick={() => onGenerate(task)}
              disabled={generatingId === task.id}
              className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            >
              {generatingId === task.id ? "Gerando..." : "Gerar proximas"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="inline-flex items-center gap-2">
              <PencilLine className="h-3.5 w-3.5" />
              Editar
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

function TaskSection({ title, subtitle, icon: Icon, count, emptyText, children, tone = "slate" }) {
  const toneMap = {
    rose: "border-rose-200 dark:border-rose-900/40",
    sky: "border-sky-200 dark:border-sky-900/40",
    emerald: "border-emerald-200 dark:border-emerald-900/40",
    slate: "border-slate-200 dark:border-slate-700/70",
  };

  return (
    <section className={cx("rounded-[32px] border bg-white p-6 shadow-sm dark:bg-slate-900/80", toneMap[tone] || toneMap.slate)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
            <Icon className="h-3.5 w-3.5" />
            {title}
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {count} item(ns)
        </div>
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function TaskFormFields({
  form,
  stays,
  rooms,
  onFieldChange,
  onRecurrenceChange,
  allowRecurringToggle,
  recurrenceReadonly,
}) {
  return (
    <div className="space-y-6">
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

      {allowRecurringToggle ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => onFieldChange("isRecurring", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Criar como modelo recorrente
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                A recorrencia continua sendo uma area experimental. Mantive suporte, mas agora com configuracao mais completa para reduzir falhas.
              </p>
            </div>
          </label>

          {form.isRecurring ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo</label>
                  <select
                    value={form.recurrence.mode}
                    onChange={(e) => onRecurrenceChange("mode", e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {RECURRENCE_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data inicial</label>
                  <input
                    type="date"
                    value={form.recurrence.startDate}
                    onChange={(e) => onRecurrenceChange("startDate", e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              {(form.recurrence.mode === "monthly_by_day" ||
                form.recurrence.mode === "monthly_twice") ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Dia(s) do mes
                  </label>
                  <input
                    value={(form.recurrence.days || []).join(",")}
                    onChange={(e) =>
                      onRecurrenceChange("days", parseNumberList(e.target.value, { min: 1, max: 31 }))
                    }
                    placeholder={form.recurrence.mode === "monthly_twice" ? "Ex.: 5,20" : "Ex.: 12"}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Use numeros separados por virgula. Para o modo 2x ao mes, informe dois dias.
                  </p>
                </div>
              ) : null}

              {form.recurrence.mode === "biweekly" ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data ancora</label>
                  <input
                    type="date"
                    value={form.recurrence.anchor}
                    onChange={(e) => onRecurrenceChange("anchor", e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Essa data define o ponto de partida da quinzena.
                  </p>
                </div>
              ) : null}

              {form.recurrence.mode === "weekly" || form.recurrence.mode === "yearly_firstWeek" ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dia(s) da semana</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((option) => {
                      const isActive = (form.recurrence.weekdays || []).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            onRecurrenceChange(
                              "weekdays",
                              (
                                isActive
                                  ? (form.recurrence.weekdays || []).filter((item) => item !== option.value)
                                  : [...(form.recurrence.weekdays || []), option.value]
                              ).sort(
                                (a, b) =>
                                  WEEKDAY_OPTIONS.findIndex((item) => item.value === a) -
                                  WEEKDAY_OPTIONS.findIndex((item) => item.value === b)
                              )
                            )
                          }
                          className={cx(
                            "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                            isActive
                              ? "border-sky-700 bg-sky-700 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950"
                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {form.recurrence.mode === "yearly_firstWeek" ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Meses de referencia
                  </label>
                  <input
                    value={(form.recurrence.months || []).join(",")}
                    onChange={(e) =>
                      onRecurrenceChange("months", parseNumberList(e.target.value, { min: 1, max: 12 }))
                    }
                    placeholder="Ex.: 1,7,12"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Informe os meses em numero. Ex.: 1 para janeiro, 12 para dezembro.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {form.isRecurring && recurrenceReadonly ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            <Repeat className="h-3.5 w-3.5" />
            Regra recorrente
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            {formatRecurrence(form.recurrence)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            A regra do modelo fica apenas para consulta aqui. Se precisar refazer a recorrencia, o caminho mais seguro continua sendo criar um novo modelo.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function buildDefaultFilters() {
  return {
    search: "",
    status: "",
    type: "",
    stayId: "",
    roomId: "",
    focus: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
    showRecurringModels: false,
  };
}

export default function Maintenance() {
  const api = useApi();
  const todayKey = dayjs().format("YYYY-MM-DD");
  const referenceDate = useMemo(() => dayjs(todayKey), [todayKey]);

  const [tasks, setTasks] = useState([]);
  const [stays, setStays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(buildDefaultFilters);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(buildEmptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [generatingId, setGeneratingId] = useState("");

  const orderedStays = useMemo(() => [...stays].sort(sortStays), [stays]);
  const orderedRooms = useMemo(() => [...rooms].sort(sortRooms), [rooms]);
  const roomMap = useMemo(
    () => new Map(orderedRooms.map((room) => [room.id, room])),
    [orderedRooms]
  );

  const roomsForFilters = useMemo(
    () => orderedRooms.filter((room) => !filters.stayId || room.stayId === filters.stayId),
    [filters.stayId, orderedRooms]
  );
  const roomsForCreate = useMemo(
    () => orderedRooms.filter((room) => !form.stayId || room.stayId === form.stayId),
    [form.stayId, orderedRooms]
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
      setError("");

      try {
        const [staysResponse, roomsResponse, tasksResponse] = await Promise.all([
          api("/stays"),
          api("/rooms"),
          api("/maintenance?includeModels=true"),
        ]);

        setStays(Array.isArray(staysResponse) ? staysResponse : []);
        setRooms(Array.isArray(roomsResponse) ? roomsResponse : []);
        setTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
      } catch (err) {
        console.error("Erro ao carregar manutencao:", err);
        setError(err?.message || "Erro ao carregar as atividades de manutencao.");
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

  const reloadTasks = useCallback(async () => {
    await loadData({ silent: true });
  }, [loadData]);

  const operationalTasks = useMemo(
    () => tasks.filter((task) => !task.isRecurring),
    [tasks]
  );
  const recurringModels = useMemo(
    () => sortTasksByDate(tasks.filter((task) => task.isRecurring), "desc"),
    [tasks]
  );

  const operationalSummary = useMemo(() => {
    const activeItems = operationalTasks.filter((task) => isTaskActive(task));
    const overdue = activeItems.filter((task) => isTaskOverdue(task, referenceDate)).length;
    const dueToday = activeItems.filter((task) => isTaskDueToday(task, referenceDate)).length;
    const next7 = activeItems.filter(
      (task) =>
        !isTaskDueToday(task, referenceDate) &&
        Boolean(task.dueDate) &&
        isTaskDueWithinDays(task, referenceDate, 7)
    ).length;
    const unscheduled = activeItems.filter((task) => !task.dueDate).length;

    return {
      total: operationalTasks.length,
      active: activeItems.length,
      overdue,
      dueToday,
      next7,
      unscheduled,
      completed: operationalTasks.filter((task) => isTaskCompleted(task)).length,
      recurringModels: recurringModels.length,
    };
  }, [operationalTasks, recurringModels.length, referenceDate]);

  const maintenanceAlert = useMemo(
    () => buildMaintenanceAlert(operationalSummary),
    [operationalSummary]
  );

  const filteredTasks = useMemo(() => {
    const search = normalizeText(filters.search);

    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.type && task.type !== filters.type) return false;
      if (filters.stayId && (task.stayId || task.stay?.id) !== filters.stayId) return false;
      if (filters.roomId && (task.roomId || task.room?.id) !== filters.roomId) return false;
      if (search && !buildTaskSearchBlob(task).includes(search)) return false;
      if (!matchesDatePreset(task, filters, referenceDate)) return false;
      return true;
    });
  }, [filters, referenceDate, tasks]);

  const filteredOperationalTasks = useMemo(
    () => filteredTasks.filter((task) => !task.isRecurring),
    [filteredTasks]
  );
  const filteredRecurringModels = useMemo(
    () => sortTasksByDate(filteredTasks.filter((task) => task.isRecurring), "desc"),
    [filteredTasks]
  );

  const overdueTasks = useMemo(
    () =>
      sortTasksByDate(
        filteredOperationalTasks.filter((task) => isTaskOverdue(task, referenceDate)),
        "asc"
      ),
    [filteredOperationalTasks, referenceDate]
  );
  const activeTasks = useMemo(
    () =>
      sortTasksByDate(
        filteredOperationalTasks.filter(
          (task) => isTaskActive(task) && !isTaskOverdue(task, referenceDate)
        ),
        "asc"
      ),
    [filteredOperationalTasks, referenceDate]
  );
  const completedTasks = useMemo(
    () => sortTasksByDate(filteredOperationalTasks.filter((task) => isTaskCompleted(task)), "desc"),
    [filteredOperationalTasks]
  );
  const dueTodayTasks = useMemo(
    () =>
      sortTasksByDate(
        filteredOperationalTasks.filter((task) => isTaskDueToday(task, referenceDate)),
        "asc"
      ),
    [filteredOperationalTasks, referenceDate]
  );

  const visibleTaskCountByFocus = {
    all: filteredOperationalTasks.length + (filters.showRecurringModels ? filteredRecurringModels.length : 0),
    open: activeTasks.length,
    overdue: overdueTasks.length,
    dueToday: dueTodayTasks.length,
    completed: completedTasks.length,
  };

  const visibleTaskCount = visibleTaskCountByFocus[filters.focus] ?? visibleTaskCountByFocus.all;
  const hiddenModelsCount =
    filters.focus === "all" && !filters.showRecurringModels ? filteredRecurringModels.length : 0;

  const openCreateModal = useCallback(() => {
    setForm(buildEmptyForm());
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((task) => {
    setSelected(task);
    setEditForm(mapTaskToForm(task));
  }, []);

  const closeEditModal = useCallback(() => {
    setSelected(null);
    setEditForm(buildEmptyForm());
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(buildDefaultFilters());
  }, []);

  const handleSummaryCardClick = useCallback((focus) => {
    setFilters((current) => {
      const nextFocus = current.focus === focus ? "all" : focus;

      return {
        ...current,
        focus: nextFocus,
        status: "",
        datePreset: "all",
        dateFrom: "",
        dateTo: "",
      };
    });
  }, []);

  const handleCreateFieldChange = useCallback(
    (field, value) => {
      setForm((current) => applyTaskFieldChange(current, field, value, roomMap));
    },
    [roomMap]
  );

  const handleEditFieldChange = useCallback(
    (field, value) => {
      setEditForm((current) => applyTaskFieldChange(current, field, value, roomMap));
    },
    [roomMap]
  );

  const handleCreateRecurrenceChange = useCallback((field, value) => {
    setForm((current) => applyRecurrenceFieldChange(current, field, value));
  }, []);

  const handleEditRecurrenceChange = useCallback((field, value) => {
    setEditForm((current) => applyRecurrenceFieldChange(current, field, value));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!form.title.trim()) {
        alert("Informe um titulo para a atividade.");
        return;
      }

      try {
        setSavingCreate(true);
        await api("/maintenance", {
          method: "POST",
          body: JSON.stringify(buildTaskPayload(form)),
        });

        setModalOpen(false);
        setForm(buildEmptyForm());
        await reloadTasks();
      } catch (err) {
        console.error("Erro ao criar tarefa de manutencao:", err);
        alert(err?.message || "Erro ao criar tarefa.");
      } finally {
        setSavingCreate(false);
      }
    },
    [api, form, reloadTasks]
  );

  const handleUpdate = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selected) return;

      try {
        setSavingEdit(true);
        const payload = buildTaskPayload(editForm);
        await api(`/maintenance/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            stayId: payload.stayId,
            roomId: payload.roomId,
            responsible: payload.responsible,
            status: payload.status,
            type: payload.type,
            dueDate: payload.dueDate,
          }),
        });

        closeEditModal();
        await reloadTasks();
      } catch (err) {
        console.error("Erro ao atualizar tarefa de manutencao:", err);
        alert(err?.message || "Erro ao atualizar tarefa.");
      } finally {
        setSavingEdit(false);
      }
    },
    [api, closeEditModal, editForm, reloadTasks, selected]
  );

  const handleDelete = useCallback(async () => {
    if (!selected) return;

    const confirmMessage = selected.isRecurring
      ? "Excluir este modelo recorrente? As ocorrencias ja geradas nao serao removidas automaticamente."
      : "Excluir esta atividade de manutencao?";

    if (!window.confirm(confirmMessage)) return;

    try {
      setDeletingId(selected.id);
      await api(`/maintenance/${selected.id}`, { method: "DELETE" });
      closeEditModal();
      await reloadTasks();
    } catch (err) {
      console.error("Erro ao excluir tarefa de manutencao:", err);
      alert(err?.message || "Erro ao excluir tarefa.");
    } finally {
      setDeletingId("");
    }
  }, [api, closeEditModal, reloadTasks, selected]);

  const handleGenerate = useCallback(
    async (task) => {
      if (!task?.id) return;
      if (!window.confirm(`Gerar proximas ocorrencias para "${task.title}"?`)) return;

      try {
        setGeneratingId(task.id);
        const response = await api(`/maintenance/${task.id}/generate?months=12`, {
          method: "POST",
        });
        alert(response?.message || "Ocorrencias geradas com sucesso.");
        await reloadTasks();
      } catch (err) {
        console.error("Erro ao gerar recorrencias:", err);
        alert(err?.message || "Erro ao gerar recorrencias.");
      } finally {
        setGeneratingId("");
      }
    },
    [api, reloadTasks]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/80 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:p-8">
          <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10" />

          <div className="relative grid gap-8 lg:grid-cols-[1.45fr,0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Maintenance Control
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">
                Controle total da manutenção, sem perder tempo.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                Identifique atrasos, organize prioridades e execute mais rápido com uma visão clara do que precisa ser feito agora.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  <Plus className="h-4 w-4" />
                  Nova atividade
                </button>

                <button
                  type="button"
                  onClick={reloadTasks}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={cx("h-4 w-4", refreshing ? "animate-spin" : "")} />
                  Atualizar
                </button>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-emerald-50/70 p-5 shadow-sm dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Visao rapida
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Em aberto</span>
                    <span className="text-2xl font-black tracking-[-0.05em] text-slate-900 dark:text-slate-100">
                      {operationalSummary.active}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {operationalSummary.overdue} atrasadas, {operationalSummary.dueToday} vencem hoje.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Planejamento</span>
                    <span className="text-2xl font-black tracking-[-0.05em] text-slate-900 dark:text-slate-100">
                      {operationalSummary.next7}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Atividades previstas para os proximos 7 dias.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Modelos recorrentes</span>
                    <span className="text-2xl font-black tracking-[-0.05em] text-slate-900 dark:text-slate-100">
                      {operationalSummary.recurringModels}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Mantidos na base, com visibilidade opcional na tela.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        {!loading && hiddenModelsCount > 0 ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            {hiddenModelsCount} modelo(s) recorrente(s) estao ocultos da visao operacional. Ative o filtro "Mostrar modelos recorrentes" se quiser audita-los.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <SummaryCard
            title="Em aberto"
            value={operationalSummary.active}
            helper="Atividades ativas na operacao."
            tone="sky"
            icon={Clock3}
            active={filters.focus === "open"}
            onClick={() => handleSummaryCardClick("open")}
          />
          <SummaryCard
            title="Atrasadas"
            value={operationalSummary.overdue}
            helper="Demandam intervencao imediata."
            tone="rose"
            icon={AlertTriangle}
            active={filters.focus === "overdue"}
            onClick={() => handleSummaryCardClick("overdue")}
          />
          <SummaryCard
            title="Vencem hoje"
            value={operationalSummary.dueToday}
            helper="Precisam entrar no fluxo do dia."
            tone="emerald"
            icon={CalendarClock}
            active={filters.focus === "dueToday"}
            onClick={() => handleSummaryCardClick("dueToday")}
          />
          <SummaryCard
            title="Concluidas"
            value={operationalSummary.completed}
            helper="Historico operacional concluido."
            tone="slate"
            icon={CheckCircle2}
            active={filters.focus === "completed"}
            onClick={() => handleSummaryCardClick("completed")}
          />
        </div>

        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                <Filter className="h-3.5 w-3.5" />
                Filtros e recortes
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Busque por codigo, titulo, descricao, empreendimento, unidade ou responsavel.
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Busca</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.search}
                  onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                  placeholder="Buscar por codigo, titulo, descricao, local..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((current) => ({ ...current, type: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empreendimento</label>
              <select
                value={filters.stayId}
                onChange={(e) =>
                  setFilters((current) => {
                    const nextStayId = e.target.value;
                    const activeRoom = roomMap.get(current.roomId);
                    return {
                      ...current,
                      stayId: nextStayId,
                      roomId:
                        activeRoom && activeRoom.stayId !== nextStayId ? "" : current.roomId,
                    };
                  })
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todos</option>
                {orderedStays.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    {stay.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Unidade / local</label>
              <select
                value={filters.roomId}
                onChange={(e) => setFilters((current) => ({ ...current, roomId: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todos</option>
                {roomsForFilters.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.stay?.name ? `${room.stay.name} - ` : ""}
                    {room.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {DATE_PRESET_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={filters.datePreset === option.value}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    datePreset: option.value,
                    ...(option.value === "custom"
                      ? {}
                      : {
                        dateFrom: "",
                        dateTo: "",
                      }),
                  }))
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data inicial</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    datePreset: "custom",
                    dateFrom: e.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data final</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    datePreset: "custom",
                    dateTo: e.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 lg:mt-7">
              <input
                type="checkbox"
                checked={filters.showRecurringModels}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    showRecurringModels: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
              Mostrar modelos recorrentes
            </label>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white/90 p-10 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-sky-600 dark:text-sky-400" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Carregando atividades de manutencao...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-[32px] border border-rose-200 bg-white/90 p-8 shadow-sm dark:border-rose-900/40 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Falha ao carregar
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{error}</p>
              </div>

              <button
                type="button"
                onClick={reloadTasks}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Resultado da tela
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Exibindo {visibleTaskCount} item(ns), sendo {filteredOperationalTasks.length} operacionais
                    {filters.showRecurringModels ? ` e ${filteredRecurringModels.length} modelo(s)` : ""}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                    Filtro de data:{" "}
                    {DATE_PRESET_OPTIONS.find((option) => option.value === filters.datePreset)?.label || "Tudo"}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                    Visao: {FOCUS_LABELS[filters.focus] || FOCUS_LABELS.all}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                    Atualizacao: {referenceDate.format("DD/MM/YYYY")}
                  </span>
                </div>
              </div>
            </section>

            {visibleTaskCount === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                <CalendarRange className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma atividade encontrada
                </h2>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Ajuste os filtros ou crie uma nova atividade para preencher a operacao.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Limpar filtros
                  </button>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="rounded-2xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    Criar atividade
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filters.focus === "all" || filters.focus === "overdue" ? (
                  <TaskSection
                    title="Criticas"
                    subtitle="Atividades vencidas e ainda sem conclusao."
                    icon={AlertTriangle}
                    count={overdueTasks.length}
                    emptyText="Nenhuma atividade atrasada neste recorte."
                    tone="rose"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {overdueTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          referenceDate={referenceDate}
                          onEdit={openEditModal}
                          onGenerate={handleGenerate}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </TaskSection>
                ) : null}

                {filters.focus === "all" || filters.focus === "open" ? (
                  <TaskSection
                    title="Em andamento / pendentes"
                    subtitle="Fila operacional organizada por prazo."
                    icon={Wrench}
                    count={activeTasks.length}
                    emptyText="Nenhuma atividade ativa restante para este recorte."
                    tone="sky"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {activeTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          referenceDate={referenceDate}
                          onEdit={openEditModal}
                          onGenerate={handleGenerate}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </TaskSection>
                ) : null}

                {filters.focus === "dueToday" ? (
                  <TaskSection
                    title="Vencem hoje"
                    subtitle="Demandas que precisam entrar na operacao ainda hoje."
                    icon={CalendarClock}
                    count={dueTodayTasks.length}
                    emptyText="Nenhuma atividade com vencimento hoje neste recorte."
                    tone="emerald"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {dueTodayTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          referenceDate={referenceDate}
                          onEdit={openEditModal}
                          onGenerate={handleGenerate}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </TaskSection>
                ) : null}

                {filters.focus === "all" || filters.focus === "completed" ? (
                  <TaskSection
                    title="Concluidas"
                    subtitle="Historico recente de atividades finalizadas."
                    icon={CheckCircle2}
                    count={completedTasks.length}
                    emptyText="Nenhuma atividade concluida neste recorte."
                    tone="slate"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {completedTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          referenceDate={referenceDate}
                          onEdit={openEditModal}
                          onGenerate={handleGenerate}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </TaskSection>
                ) : null}

                {filters.focus === "all" && filters.showRecurringModels ? (
                  <TaskSection
                    title="Modelos recorrentes"
                    subtitle="Area de auditoria para os templates de recorrencia."
                    icon={Repeat}
                    count={filteredRecurringModels.length}
                    emptyText="Nenhum modelo recorrente encontrado com os filtros atuais."
                    tone="emerald"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {filteredRecurringModels.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          referenceDate={referenceDate}
                          onEdit={openEditModal}
                          onGenerate={handleGenerate}
                          generatingId={generatingId}
                        />
                      ))}
                    </div>
                  </TaskSection>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova atividade de manutencao"
        subtitle="Crie demandas avulsas ou cadastre um modelo recorrente com a configuracao suportada pela API."
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <TaskFormFields
            form={form}
            stays={orderedStays}
            rooms={roomsForCreate}
            onFieldChange={handleCreateFieldChange}
            onRecurrenceChange={handleCreateRecurrenceChange}
            allowRecurringToggle
            recurrenceReadonly={false}
          />

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCreate}
              className="rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              {savingCreate ? "Salvando..." : "Salvar atividade"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={closeEditModal}
        title={selected?.isRecurring ? "Editar modelo recorrente" : "Editar atividade"}
        subtitle={
          selected?.isRecurring
            ? "Edite os metadados do modelo. A regra recorrente fica visivel em modo leitura."
            : "Atualize status, prazo e contexto da atividade selecionada."
        }
      >
        {selected ? (
          <form className="space-y-6" onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Codigo
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {selected.code}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Categoria
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {selected.isRecurring ? "Modelo recorrente" : "Atividade operacional"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Prazo atual
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {selected.dueDate ? formatDisplayDate(selected.dueDate) : "Sem prazo definido"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Ultima atualizacao
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatDisplayDate(selected.updatedAt || selected.createdAt)}
                </div>
              </div>
            </div>

            <TaskFormFields
              form={editForm}
              stays={orderedStays}
              rooms={roomsForEdit}
              onFieldChange={handleEditFieldChange}
              onRecurrenceChange={handleEditRecurrenceChange}
              allowRecurringToggle={false}
              recurrenceReadonly={Boolean(selected.isRecurring)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletingId === selected.id}
                  className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                >
                  {deletingId === selected.id ? "Excluindo..." : "Excluir"}
                </button>

                {selected.isRecurring ? (
                  <button
                    type="button"
                    onClick={() => handleGenerate(selected)}
                    disabled={generatingId === selected.id}
                    className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                  >
                    {generatingId === selected.id ? "Gerando..." : "Gerar ocorrencias"}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  {savingEdit ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

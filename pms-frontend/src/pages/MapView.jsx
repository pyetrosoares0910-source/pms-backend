import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { isViewer } from "../lib/permissions";
import { isHolidaySP } from "../lib/holidays";
import CleaningDateModal from "../components/CleaningDateModal";
import {
  BedDouble,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";

// ===== utils =====
const pad2 = (n) => String(n).padStart(2, "0");
const fmtBR = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(
    d.getFullYear()
  ).slice(-2)}`;
const fmtISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffInDays = (a, b) =>
  Math.round((startOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function parseDateOnly(isoString) {
  const [y, m, d] = isoString.split("T")[0].split("-");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function formatReservationTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const hasTime =
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0 ||
    date.getMilliseconds() !== 0;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function hasMeaningfulReservationUpdate(reservation) {
  if (!reservation?.createdAt || !reservation?.updatedAt) return false;
  const createdAt = new Date(reservation.createdAt).getTime();
  const updatedAt = new Date(reservation.updatedAt).getTime();

  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) return false;
  return Math.abs(updatedAt - createdAt) > 1000;
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return parseDateOnly(aStart) < parseDateOnly(bEnd) && parseDateOnly(aEnd) > parseDateOnly(bStart);
}

// util local só pro picker (mantém YYYY-MM-DD)
function toISODateOnlyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const ReservationStatus = {
  REGISTRADA: "registrada",
  AGENDADA: "agendada",
  ATIVA: "ativa",
  CONCLUIDA: "concluida",
  CANCELADA: "cancelada",
};

function colorByStatus(status) {
  switch (status) {
    case ReservationStatus.REGISTRADA:
      return "bg-[#8E44AD]";
    case ReservationStatus.AGENDADA:
      return "bg-sky-500";
    case ReservationStatus.ATIVA:
      return "bg-rose-500";
    case ReservationStatus.CONCLUIDA:
      return "bg-emerald-600";
    case ReservationStatus.CANCELADA:
      return "bg-neutral-400";
    default:
      return "bg-blue-600";
  }
}

// largura da coluna das UHs (antes era 260px)
const ROOM_COL_WIDTH = 200;

// ===== Modal base =====
function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} mx-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100`}>
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * ===== Date Range Picker (2 cliques) =====
 * - 1º clique: check-in
 * - 2º clique: check-out
 * - se clicar uma data anterior no 2º clique, ele troca (start/end)
 * - sem validações extras (livre), como você pediu
 * - devolve strings YYYY-MM-DD
 */
function DateRangePickerModal({
  open,
  onClose,
  initialStartISO,
  initialEndISO,
  onApply,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const toDateLocal = (iso) => {
    if (!iso) return null;
    const [y, m, d] = String(iso).split("T")[0].split("-");
    return new Date(Number(y), Number(m) - 1, Number(d));
  };

  const [startDate, setStartDate] = useState(() => toDateLocal(initialStartISO));
  const [endDate, setEndDate] = useState(() => toDateLocal(initialEndISO));
  const [view, setView] = useState(() => {
    const base = toDateLocal(initialStartISO) || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    setStartDate(toDateLocal(initialStartISO));
    setEndDate(toDateLocal(initialEndISO));
    const base = toDateLocal(initialStartISO) || new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, initialStartISO, initialEndISO]);

  const monthLabel = useMemo(() => {
    const m = view.toLocaleString("pt-BR", { month: "long" });
    return `${m.charAt(0).toUpperCase() + m.slice(1)} ${view.getFullYear()}`;
  }, [view]);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const last = new Date(view.getFullYear(), view.getMonth() + 1, 0);
    const startWeekday = first.getDay(); // 0 DOM
    const total = last.getDate();

    const slots = [];
    for (let i = 0; i < startWeekday; i++) slots.push(null);
    for (let d = 1; d <= total; d++)
      slots.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (slots.length % 7 !== 0) slots.push(null);

    return slots;
  }, [view]);

  const isSameDay = (a, b) =>
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isInRange = (d) => {
    if (!d || !startDate) return false;
    if (!endDate) return isSameDay(d, startDate);
    const t = d.getTime();
    const a = startDate.getTime();
    const b = endDate.getTime();
    return t >= Math.min(a, b) && t <= Math.max(a, b);
  };

  const handlePick = (d) => {
    if (!d) return;

    // Se não tem start ainda, ou já tinha start+end: recomeça seleção
    if (!startDate || (startDate && endDate)) {
      setStartDate(d);
      setEndDate(null);
      return;
    }

    // Segundo clique
    if (d.getTime() < startDate.getTime()) {
      setEndDate(startDate);
      setStartDate(d);
    } else {
      setEndDate(d);
    }
  };

  const canApply = !!(startDate && endDate);

  return (
    <Modal open={open} onClose={onClose} title="Selecionar período">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
          onClick={() =>
            setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
          }
          title="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="font-semibold text-slate-900 dark:text-slate-100">{monthLabel}</div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
          onClick={() =>
            setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
          }
          title="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] mb-2 text-slate-500 dark:text-slate-300">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const active = isInRange(d);
          const isEdge = isSameDay(d, startDate) || isSameDay(d, endDate);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(d)}
              disabled={!d}
              className={[
                "h-10 rounded-lg text-sm transition select-none",
                !d ? "opacity-0 pointer-events-none" : "",
                active
                  ? isEdge
                    ? "bg-sky-600 text-white"
                    : isDark
                      ? "bg-sky-900/50 text-slate-100"
                      : "bg-sky-100 text-slate-900"
                  : isDark
                    ? "hover:bg-slate-800"
                    : "hover:bg-slate-100",
              ].join(" ")}
              title={d ? fmtBR(d) : ""}
            >
              {d ? d.getDate() : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {startDate ? fmtBR(startDate) : "__/__/__"} →{" "}
          {endDate ? fmtBR(endDate) : "__/__/__"}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg border-slate-300 dark:border-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              onApply(toISODateOnlyLocal(startDate), toISODateOnlyLocal(endDate));
              onClose();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
          >
            OK
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Dica: clique 1x para check-in e 1x para check-out.
      </div>
    </Modal>
  );
}

// ===== Barra de reserva =====
function ReservationBar({ res, day0, days, cellW = 45, onClick }) {
  const ci = parseDateOnly(res.checkinDate);
  const co = parseDateOnly(res.checkoutDate);
  const coAdj = addDays(co, 1);

  const rangeEnd = addDays(day0, days);
  if (coAdj <= day0 || ci >= rangeEnd) return null;

  const startIdx = clamp(diffInDays(day0, ci), 0, days - 1);
  const endIdxExclusive = clamp(diffInDays(day0, coAdj), 0, days);

  const startsInside = ci >= day0 && ci < rangeEnd;
  const endsInside = coAdj > day0 && coAdj <= rangeEnd;

  const leftPx = startIdx * cellW + (startsInside ? cellW / 2.35 : 0);
  const rightPx =
    days * cellW - endIdxExclusive * cellW + (endsInside ? cellW / 2.35 : 0);
  const widthPx = days * cellW - leftPx - rightPx;
  const color = colorByStatus(res.status);

  let clip = "0 0, 100% 0, 100% 100%, 0 100%";
  if (startsInside && endsInside) {
    clip = "10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%";
  } else if (startsInside) {
    clip = "10px 0, 100% 0, 100% 100%, 0 100%";
  } else if (endsInside) {
    clip = "0 0, 100% 0, calc(100% - 10px) 100%, 0 100%";
  }

  return (
    <div
      className="absolute top-[7px] bottom-[7px]"
      style={{ left: leftPx, width: widthPx }}
    >
      <button
        onClick={() => onClick?.(res)}
        className={`relative flex h-[24px] w-full items-center overflow-hidden rounded-md ${color} pl-4 pr-2 text-white shadow-sm shadow-slate-900/20 ring-1 ring-white/20 transition hover:brightness-105`}
        style={{ clipPath: `polygon(${clip})` }}
        title={`${res.guest?.name || "(sem nome)"} • ${fmtBR(ci)} → ${fmtBR(
          co
        )}`}
      >
        <span className="truncate text-[12px] font-semibold tracking-[0.01em]">
          {res.guest?.name || "(sem nome)"}
        </span>
      </button>
    </div>
  );
}

// ===== Modais (ações + adicionar reserva) =====
function ReservationActionsModal({
  open,
  onClose,
  reservation,
  onUpdated,
  rooms,
}) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [assignmentConflict, setAssignmentConflict] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [removingAssignment, setRemovingAssignment] = useState(false);

  if (!open || !reservation) return null;

  async function updateStatus(newStatus) {
    setLoading(true);
    setAssignmentConflict(null);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error(err);
      if (err?.status === 409 && err?.payload?.details?.code === "ASSIGNED_MAID_CONFLICT") {
        setPendingStatus(newStatus);
        setAssignmentConflict(err.payload.details);
        return;
      }
      alert(err?.message || "Erro ao atualizar reserva");
    } finally {
      setLoading(false);
    }
  }

  async function removeAssignmentAndRetryStatus() {
    const taskId = assignmentConflict?.task?.id;
    if (!taskId || !pendingStatus) return;

    setRemovingAssignment(true);
    try {
      await api(`/tasks/${taskId}/assign`, {
        method: "PUT",
        body: JSON.stringify({ maidId: null }),
      });
      setAssignmentConflict(null);
      await updateStatus(pendingStatus);
    } catch (err) {
      console.error("Erro ao remover designacao:", err);
      alert(err?.message || "Erro ao remover designacao da diarista.");
    } finally {
      setRemovingAssignment(false);
    }
  }

  const ci = parseDateOnly(reservation.checkinDate);
  const co = parseDateOnly(reservation.checkoutDate);
  const cleaningDate = parseDateOnly(reservation.cleaningDateOverride || reservation.checkoutDate);
  const createdAtLabel = formatReservationTimestamp(reservation.createdAt);
  const updatedAtLabel = hasMeaningfulReservationUpdate(reservation)
    ? formatReservationTimestamp(reservation.updatedAt)
    : "";
  const otherAssignments = (assignmentConflict?.sameDayAssignments || []).filter(
    (item) => !item.isCurrentReservation
  );

  return (
    <>
      <Modal open={open} onClose={onClose} title="Ações da Reserva">
        <h2 className="text-lg font-semibold mb-1">
          {reservation.guest?.name} • {reservation.room?.title}
        </h2>
        <p className="text-sm mb-4 text-slate-600 dark:text-slate-300">
          {fmtBR(ci)} → {fmtBR(co)}
        </p>
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Limpeza:
          </span>{" "}
          {fmtBR(cleaningDate)}
          {reservation.cleaningDateOverride ? (
            <div className="mt-1">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Motivo:
              </span>{" "}
              {reservation.cleaningChangeReason || "Nao informado"}
            </div>
          ) : null}
        </div>
        {(createdAtLabel || updatedAtLabel) && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
            {createdAtLabel && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Criada em:
                </span>{" "}
                {createdAtLabel}
              </div>
            )}
            {updatedAtLabel && (
              <div className="mt-1">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Ultima alteracao:
                </span>{" "}
                {updatedAtLabel}
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          {assignmentConflict && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="font-semibold">
                Existe diarista designada neste check-out
              </div>
              <div className="mt-1">
                {assignmentConflict.maid?.name || "Diarista"} esta marcada em{" "}
                {assignmentConflict.date
                  ? fmtBR(parseDateOnly(assignmentConflict.date))
                  : "data nao informada"}{" "}
                para {assignmentConflict.task?.stay} - {assignmentConflict.task?.rooms}.
              </div>
              {assignmentConflict.isOnlyAssignmentForMaidThatDay ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 font-medium dark:border-amber-800 dark:bg-slate-950/40">
                  Desmarcar com {assignmentConflict.maid?.name || "a diarista"}.
                </div>
              ) : (
                <div className="mt-3">
                  <div className="font-medium">
                    Outras reservas designadas para ela neste dia:
                  </div>
                  <div className="mt-2 space-y-1">
                    {otherAssignments.length > 0 ? (
                      otherAssignments.map((item) => (
                        <div
                          key={item.taskId}
                          className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-950/40"
                        >
                          <span className="font-medium">
                            {item.stay} - {item.rooms}
                          </span>
                          {item.guestName ? (
                            <span className="text-amber-800 dark:text-amber-200">
                              {" "}
                              / {item.guestName}
                            </span>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-950/40">
                        Nenhuma outra reserva encontrada para esta diarista no dia.
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={removeAssignmentAndRetryStatus}
                disabled={removingAssignment || loading}
                className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {removingAssignment
                  ? "Removendo designacao..."
                  : "Remover designacao desta reserva e continuar"}
              </button>
            </div>
          )}

          <button
            onClick={() => updateStatus("ativa")}
            disabled={loading}
            className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
          >
            Fazer check-in
          </button>
          <button
            onClick={() => updateStatus("agendada")}
            disabled={loading}
            className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
          >
            Reverter check-in
          </button>
          <button
            onClick={() => updateStatus("registrada")}
            disabled={loading || reservation.status !== "agendada"}
            className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg"
          >
            Reverter para registrada
          </button>
          <button
            onClick={() => updateStatus("concluida")}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Expedia - cobrar limpeza
          </button>
          <button
            onClick={() => setCleaningOpen(true)}
            disabled={loading || reservation.status === "cancelada"}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg mt-4"
          >
            Alterar dia de limpeza
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
          >
            Editar reserva
          </button>
          <button
            onClick={() => updateStatus("cancelada")}
            disabled={loading}
            className="w-full px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg"
          >
            Cancelar reserva
          </button>
        </div>
      </Modal>

      <EditReservationModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        reservation={reservation}
        rooms={rooms}
        onUpdated={onUpdated}
      />
      <CleaningDateModal
        open={cleaningOpen}
        onClose={() => setCleaningOpen(false)}
        reservation={reservation}
        onUpdated={onUpdated}
      />
    </>
  );
}

function EditReservationModal({ open, onClose, reservation, rooms, onUpdated }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [assignmentConflict, setAssignmentConflict] = useState(null);
  const [removingAssignment, setRemovingAssignment] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const [form, setForm] = useState({
    checkinDate: "",
    checkoutDate: "",
    roomId: "",
    notes: "",
  });

  useEffect(() => {
    if (reservation) {
      setAssignmentConflict(null);
      setForm({
        checkinDate: reservation.checkinDate?.split("T")[0] || "",
        checkoutDate: reservation.checkoutDate?.split("T")[0] || "",
        roomId: reservation.roomId || "",
        notes: reservation.notes || "",
      });
    }
  }, [reservation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAssignmentConflict(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveReservation = async (values) => {
    setLoading(true);
    setAssignmentConflict(null);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error("Erro ao editar reserva:", err);
      if (err?.status === 409 && err?.payload?.details?.code === "ASSIGNED_MAID_CONFLICT") {
        setAssignmentConflict(err.payload.details);
        return;
      }
      alert(err?.message || "Erro ao salvar alteracoes");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await saveReservation(form);
  };

  const handleRemoveAssignmentAndSave = async () => {
    const taskId = assignmentConflict?.task?.id;
    if (!taskId) return;

    setRemovingAssignment(true);
    try {
      await api(`/tasks/${taskId}/assign`, {
        method: "PUT",
        body: JSON.stringify({ maidId: null }),
      });
      setAssignmentConflict(null);
      await saveReservation(form);
    } catch (err) {
      console.error("Erro ao remover designacao:", err);
      alert(err?.message || "Erro ao remover designacao da diarista.");
    } finally {
      setRemovingAssignment(false);
    }
  };

  if (!open || !reservation) return null;

  const otherAssignments = (assignmentConflict?.sameDayAssignments || []).filter(
    (item) => !item.isCurrentReservation
  );

  return (
    <Modal open={open} onClose={onClose} title="Editar reserva">
      <form onSubmit={handleSave} className="space-y-4">
        {/* NOVO: Período (range em 2 cliques) */}
        <div>
          <label className="text-sm">Período</label>
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="w-full border rounded-lg px-3 py-2 mt-1 text-left bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            title="Selecionar check-in e check-out"
          >
            {form.checkinDate ? fmtBR(parseDateOnly(form.checkinDate)) : "__/__/__"}{" "}
            →{" "}
            {form.checkoutDate ? fmtBR(parseDateOnly(form.checkoutDate)) : "__/__/__"}
          </button>

          <DateRangePickerModal
            open={rangeOpen}
            onClose={() => setRangeOpen(false)}
            initialStartISO={form.checkinDate}
            initialEndISO={form.checkoutDate}
            onApply={(ci, co) => {
              setAssignmentConflict(null);
              setForm((prev) => ({ ...prev, checkinDate: ci, checkoutDate: co }));
            }}
          />
        </div>

        <div>
          <label className="text-sm">Quarto</label>
          <select
            name="roomId"
            value={form.roomId}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 mt-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            required
          >
            <option value="">Selecione...</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.stay?.name} - {r.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm">Observações</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 mt-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            rows={3}
          />
        </div>

        {assignmentConflict && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="font-semibold">
              Existe diarista designada neste check-out
            </div>
            <div className="mt-1">
              {assignmentConflict.maid?.name || "Diarista"} esta marcada em{" "}
              {assignmentConflict.date
                ? fmtBR(parseDateOnly(assignmentConflict.date))
                : "data nao informada"}{" "}
              para {assignmentConflict.task?.stay} - {assignmentConflict.task?.rooms}.
            </div>

            {assignmentConflict.isOnlyAssignmentForMaidThatDay ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 font-medium dark:border-amber-800 dark:bg-slate-950/40">
                Desmarcar com {assignmentConflict.maid?.name || "a diarista"}.
              </div>
            ) : (
              <div className="mt-3">
                <div className="font-medium">
                  Outras reservas designadas para ela neste dia:
                </div>
                <div className="mt-2 space-y-1">
                  {otherAssignments.length > 0 ? (
                    otherAssignments.map((item) => (
                      <div
                        key={item.taskId}
                        className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-950/40"
                      >
                        <span className="font-medium">
                          {item.stay} - {item.rooms}
                        </span>
                        {item.guestName ? (
                          <span className="text-amber-800 dark:text-amber-200">
                            {" "}
                            / {item.guestName}
                          </span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-950/40">
                      Nenhuma outra reserva encontrada para esta diarista no dia.
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRemoveAssignmentAndSave}
              disabled={removingAssignment || loading}
              className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {removingAssignment
                ? "Removendo designacao..."
                : "Remover designacao desta reserva e salvar"}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            {loading ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReservationConflictModal({
  open,
  onClose,
  conflict,
  rooms,
  onCancelExisting,
  onEditExisting,
  onUpdatedExisting,
}) {
  const api = useApi();
  const [loadingId, setLoadingId] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);

  if (!open || !conflict) return null;

  const requested = conflict.requestedPeriod || {};
  const conflicts = conflict.conflictingReservations || [];
  const roomTitle =
    conflicts[0]?.room?.title ||
    rooms.find((room) => room.id === conflict.roomId)?.title ||
    "acomodacao";

  async function cancelReservation(reservation) {
    setLoadingId(reservation.id);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: ReservationStatus.CANCELADA }),
      });
      onCancelExisting(updated);
    } catch (err) {
      console.error("Erro ao cancelar reserva existente:", err);
      alert(err?.message || "Erro ao cancelar reserva existente.");
    } finally {
      setLoadingId(null);
    }
  }

  function handleUpdatedExisting(updated) {
    onUpdatedExisting(updated);
    setEditingReservation(null);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Reserva existente no periodo"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="font-semibold">
              A nova reserva nao foi inserida porque {roomTitle} ja esta ocupada.
            </div>
            <div className="mt-1">
              Periodo solicitado:{" "}
              {requested.checkinDate ? fmtBR(parseDateOnly(requested.checkinDate)) : "__/__/__"}{" "}
              ate{" "}
              {requested.checkoutDate ? fmtBR(parseDateOnly(requested.checkoutDate)) : "__/__/__"}.
            </div>
          </div>

          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {conflicts.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-50">
                      {reservation.guest?.name || "Hospede sem nome"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {reservation.room?.stay?.name ? `${reservation.room.stay.name} - ` : ""}
                      {reservation.room?.title || roomTitle}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {fmtBR(parseDateOnly(reservation.checkinDate))} ate{" "}
                      {fmtBR(parseDateOnly(reservation.checkoutDate))} / {reservation.status}
                    </div>
                    {reservation.notes ? (
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {reservation.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                    <button
                      type="button"
                      onClick={() => setEditingReservation(reservation)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Alterar datas
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelReservation(reservation)}
                      disabled={loadingId === reservation.id}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {loadingId === reservation.id ? "Cancelando..." : "Cancelar reserva"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Nao inserir nova reserva
            </button>
          </div>
        </div>
      </Modal>

      <EditReservationModal
        open={!!editingReservation}
        onClose={() => setEditingReservation(null)}
        reservation={editingReservation}
        rooms={rooms}
        onUpdated={(updated) => {
          onEditExisting?.(updated);
          handleUpdatedExisting(updated);
        }}
      />
    </>
  );
}

function AddReservationModal({ open, onClose, rooms, onCreated, onUpdated }) {
  const api = useApi();
  const [guestName, setGuestName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkin, setCheckin] = useState(fmtISO(new Date()));
  const [checkout, setCheckout] = useState(fmtISO(addDays(new Date(), 1)));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [conflict, setConflict] = useState(null);

  function removeResolvedConflict(updated) {
    setConflict((prev) => {
      if (!prev) return prev;
      const remaining = (prev.conflictingReservations || []).filter((reservation) => {
        if (reservation.id !== updated.id) return true;
        if (updated.status === ReservationStatus.CANCELADA) return false;
        if (updated.roomId !== prev.roomId) return false;
        return datesOverlap(
          updated.checkinDate,
          updated.checkoutDate,
          prev.requestedPeriod?.checkinDate,
          prev.requestedPeriod?.checkoutDate
        );
      });

      return remaining.length > 0
        ? { ...prev, conflictingReservations: remaining }
        : null;
    });
  }

  function closeAndReset() {
    setConflict(null);
    setError("");
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setConflict(null);
    let createdGuest = null;
    try {
      createdGuest = await api("/guests", {
        method: "POST",
        body: JSON.stringify({ name: guestName }),
      });

      const created = await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          guestId: createdGuest.id,
          roomId,
          checkinDate: checkin,
          checkoutDate: checkout,
          status: ReservationStatus.REGISTRADA,
          notes,
        }),
      });

      onCreated(created);
      onClose();
      setGuestName("");
      setNotes("");
    } catch (err) {
      console.error(err);
      if (
        err?.status === 409 &&
        err?.payload?.details?.code === "RESERVATION_DATE_CONFLICT"
      ) {
        if (createdGuest?.id) {
          await api(`/guests/${createdGuest.id}`, { method: "DELETE" }).catch((deleteErr) => {
            console.error("Erro ao remover hospede sem reserva:", deleteErr);
          });
        }
        setConflict(err.payload.details);
        return;
      }
      setError(err?.message || "Erro ao salvar reserva");
    } finally {
      setLoading(false);
    }
  }

  if (conflict) {
    return (
      <ReservationConflictModal
        open={open}
        onClose={closeAndReset}
        conflict={conflict}
        rooms={rooms}
        onCancelExisting={(updated) => {
          onUpdated(updated);
          removeResolvedConflict(updated);
        }}
        onEditExisting={onUpdated}
        onUpdatedExisting={removeResolvedConflict}
      />
    );
  }

  return (
    <Modal open={open} onClose={closeAndReset} title="Nova reserva">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm">Hóspede</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />
        </div>

        {/* NOVO: Período (range em 2 cliques) */}
        <div className="col-span-2">
          <label className="text-sm">Período</label>
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-left bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            title="Selecionar check-in e check-out"
          >
            {fmtBR(parseDateOnly(checkin))} → {fmtBR(parseDateOnly(checkout))}
          </button>

          <DateRangePickerModal
            open={rangeOpen}
            onClose={() => setRangeOpen(false)}
            initialStartISO={checkin}
            initialEndISO={checkout}
            onApply={(ci, co) => {
              setCheckin(ci);
              setCheckout(co);
            }}
          />
        </div>

        <div className="col-span-2">
          <label className="text-sm">Quarto</label>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.stay?.name} - {r.title}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-sm">Observações</label>
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="col-span-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeAndReset}
            className="px-4 py-2 border rounded-lg border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===== Página principal =====
export default function MapView() {
  const api = useApi();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const viewerOnly = isViewer(user);

  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const cellW = 45;
  const WINDOW_DAYS = 34; // 30 dias + 4 extras

  const [start, setStart] = useState(startOfDay(new Date()));
  const endDisplay = addDays(start, WINDOW_DAYS);
  const days = WINDOW_DAYS;

  const startPickerRef = useRef(null);

  const headerDays = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(start, i)),
    [start, days]
  );

  const goPrev = () => setStart((s) => addDays(s, -30));
  const goNext = () => setStart((s) => addDays(s, +30));
  const pickStart = (e) => setStart(startOfDay(new Date(e.target.value)));

  useEffect(() => {
    (async () => {
      try {
        const [rms, resvs] = await Promise.all([api("/rooms"), api("/reservations")]);
        setRooms(rms);
        setReservations(resvs);
        const allStays = new Set(rms.map((r) => r.stay?.name).filter(Boolean));
        setExpandedGroups(allStays);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const grouped = useMemo(() => {
    const map = {};

    rooms.forEach((r) => {
      const stayName = r.stay?.name || "Sem empreendimento";
      const stayPos = r.stay?.position ?? 9999;
      if (!map[stayName]) map[stayName] = { rooms: [], position: stayPos };
      map[stayName].rooms.push(r);
    });

    Object.values(map).forEach((group) => {
      group.rooms.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
    });

    return Object.entries(map).sort(
      ([, a], [, b]) => (a.position ?? 9999) - (b.position ?? 9999)
    );
  }, [rooms]);

  const toggleGroup = (stay) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(stay) ? next.delete(stay) : next.add(stay);
      return next;
    });
  };

  const activeReservationsCount = useMemo(
    () => reservations.filter((reservation) => reservation.status !== "cancelada").length,
    [reservations]
  );

  return (
    <div className="space-y-5 p-4 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <CalendarDays size={14} />
            mapa operacional
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Mapa de Reservas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visao por acomodacao, periodo e status das reservas.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Stays</div>
              <div className="text-lg font-black text-slate-950 dark:text-slate-50">{grouped.length}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">UHs</div>
              <div className="text-lg font-black text-slate-950 dark:text-slate-50">{rooms.length}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Reservas</div>
              <div className="text-lg font-black text-slate-950 dark:text-slate-50">{activeReservationsCount}</div>
            </div>
          </div>
        {!viewerOnly && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700"
          >
            <Plus size={18} />
            Adicionar reserva
          </button>
        )}
        </div>
      </div>

      {/* Controle de datas */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-3 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="hidden items-center gap-2 px-2 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:flex">
          <CalendarDays size={17} />
          Janela do mapa
        </div>
        <div className="mx-auto flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex w-11 items-center justify-center text-[0px] text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
            title="30 dias anteriores"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => startPickerRef.current?.showPicker?.()}
            className="border-x border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-slate-800 dark:text-sky-100 dark:hover:bg-slate-800/80"
            title="Alterar data inicial"
          >
            {`${fmtBR(start)} à ${fmtBR(endDisplay)}`}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex w-11 items-center justify-center text-[0px] text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
            title="Próximos 30 dias"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <input
          ref={startPickerRef}
          type="date"
          className="hidden"
          value={fmtISO(start)}
          onChange={pickStart}
        />
      </div>

      {/* GRID PRINCIPAL */}
      <div className="min-w-[900px] overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20">
        {/* Cabeçalho topo */}
        <div
          className="sticky top-0 z-30 grid"
          style={{
            gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
          }}
        >
          {/* Coluna UH / Mês */}
          <div
            className={`
              sticky left-0 z-40 h-12 px-4 text-sm flex items-center gap-2
              border-b border-slate-200/80 dark:border-slate-800
              font-bold tracking-wide shadow-[8px_0_18px_rgba(15,23,42,0.06)]
              ${isDark ? "bg-slate-950 text-sky-100" : "bg-slate-950 text-white"}
            `}
          >
            UH / Mês
          </div>

          {/* Linha de fundo (sem dias ainda) */}
          {Array.from({ length: days }).map((_, i) => (
            <div
              key={i}
              className={`h-12 border-b border-slate-200/80 dark:border-slate-800 ${isDark ? "bg-slate-950" : "bg-slate-950"
                }`}
            />
          ))}
        </div>

        {/* Grupos */}
        {grouped.map(([stay, rows]) => {
          const isOpen = expandedGroups.has(stay);
          return (
            <div key={stay}>
              {/* Cabeçalho do empreendimento + dias */}
              <div
                className="sticky top-10 z-20 grid"
                style={{
                  gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
                }}
              >
                {/* Coluna Stay */}
                <div
                  className={`
                    sticky left-0 z-30 px-3 h-10 flex items-center gap-2 cursor-pointer select-none
                    border-b border-slate-200/80 dark:border-slate-800 text-[13px] font-bold
                    shadow-[8px_0_18px_rgba(15,23,42,0.05)] transition
                    ${isDark
                      ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "bg-slate-100 text-slate-900 hover:bg-sky-50"
                    }
                  `}
                  onClick={() => toggleGroup(stay)}
                >
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Building2 size={15} className="text-slate-400" />
                  {stay}
                </div>

                {/* Cabeçalhos dos dias */}
                {headerDays.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isHoliday = isHolidaySP(fmtISO(d));
                  const baseBg = isDark
                    ? isHoliday
                      ? "bg-amber-950/45"
                      : isWeekend
                      ? "bg-slate-900"
                      : "bg-slate-950"
                    : isHoliday
                      ? "bg-amber-50"
                      : isWeekend
                      ? "bg-slate-50"
                      : "bg-white";

                  return (
                    <div
                      key={i}
                      className={`relative flex h-10 flex-col items-center justify-center border-l border-b border-slate-200/70 dark:border-slate-800 ${baseBg}`}
                      title={isHoliday ? `${fmtBR(d)} - Feriado` : fmtBR(d)}
                    >
                      {isHoliday && (
                        <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-300" />
                      )}
                      <div
                        className={`text-[18px] font-semibold leading-tight ${isHoliday
                          ? "text-amber-900 dark:text-amber-100"
                          : "text-slate-900 dark:text-slate-100"
                          }`}
                      >
                        {pad2(d.getDate())}
                      </div>
                      <div
                        className={`text-[10px] uppercase leading-tight ${isHoliday
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-slate-600 dark:text-slate-300"
                          }`}
                      >
                        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"][d.getDay()]}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Linhas de UHs */}
              {isOpen &&
                rows.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="relative grid transition-colors hover:bg-sky-50/35 dark:hover:bg-slate-900/60"
                    style={{
                      gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
                    }}
                  >
                    {/* Nome da UH */}
                    <div className="sticky left-0 z-10 flex h-10 items-center gap-2 border-b border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-800 shadow-[8px_0_18px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                      <BedDouble size={14} className="text-slate-400" />
                      {room.title}
                    </div>

                    {/* Células de dias */}
                    {Array.from({ length: days }).map((_, i) => {
                      const d = headerDays[i];
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isHoliday = isHolidaySP(fmtISO(d));
                      const bgClass = isDark
                        ? isHoliday
                          ? "bg-amber-950/30"
                          : isWeekend
                          ? "bg-slate-800/60"
                          : "bg-slate-900"
                        : isHoliday
                          ? "bg-amber-50"
                          : isWeekend
                          ? "bg-slate-50"
                          : "bg-white";

                      return (
                        <div
                          key={i}
                          className={`relative h-10 border-l border-b border-slate-200/70 dark:border-slate-800 ${bgClass}`}
                          title={isHoliday ? `${fmtBR(d)} - Feriado` : fmtBR(d)}
                        />
                      );
                    })}

                    {/* Faixas de reserva */}
                    <div
                      className="absolute top-0 bottom-0 right-0"
                      style={{ left: ROOM_COL_WIDTH }}
                    >
                      {reservations
                        .filter((r) => r.roomId === room.id && r.status !== "cancelada")
                        .map((r) => (
                          <ReservationBar
                            key={r.id}
                            res={r}
                            day0={start}
                            days={days}
                            onClick={viewerOnly ? undefined : setSelected}
                          />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/55 dark:text-slate-300">
        <span className="mr-1 text-slate-400">Status:</span>
        {[
          ["Registrada", "bg-[#8E44AD]"],
          ["Agendada", "bg-sky-500"],
          ["Ativa", "bg-rose-500"],
          ["Concluida", "bg-emerald-600"],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
        <span className="ml-auto hidden text-slate-400 sm:inline">
          Clique em uma reserva para acoes rapidas.
        </span>
      </div>

      {!viewerOnly && (
        <ReservationActionsModal
          open={!!selected}
          onClose={() => setSelected(null)}
          reservation={selected}
          rooms={rooms}
          onUpdated={(updated) => {
            setSelected(updated);
            setReservations((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
          }}
        />
      )}

      {!viewerOnly && (
        <AddReservationModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          rooms={rooms}
          onCreated={(res) => setReservations((prev) => [...prev, res])}
          onUpdated={(updated) =>
            setReservations((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            )
          }
        />
      )}

      {loading && (
        <div className="mt-4 text-sm text-neutral-500 dark:text-slate-400">
          Carregando mapa...
        </div>
      )}
    </div>
  );
}


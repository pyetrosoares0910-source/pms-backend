import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

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

// util local só pro picker (mantém YYYY-MM-DD)
function toISODateOnlyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const ReservationStatus = {
  AGENDADA: "agendada",
  ATIVA: "ativa",
  CONCLUIDA: "concluida",
  CANCELADA: "cancelada",
};

function colorByStatus(status) {
  switch (status) {
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
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200/70 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white"
          >
            ✕
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
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
          onClick={() =>
            setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
          }
          title="Mês anterior"
        >
          ‹
        </button>

        <div className="font-semibold">{monthLabel}</div>

        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
          onClick={() =>
            setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
          }
          title="Próximo mês"
        >
          ›
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
        className={`relative h-[22px] ${color} text-white shadow flex items-center pl-4 pr-2 overflow-hidden w-full rounded-sm`}
        style={{ clipPath: `polygon(${clip})` }}
        title={`${res.guest?.name || "(sem nome)"} • ${fmtBR(ci)} → ${fmtBR(
          co
        )}`}
      >
        <span className="truncate text-[12px]">
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

  if (!open || !reservation) return null;

  async function updateStatus(newStatus) {
    setLoading(true);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar reserva");
    } finally {
      setLoading(false);
    }
  }

  const ci = parseDateOnly(reservation.checkinDate);
  const co = parseDateOnly(reservation.checkoutDate);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Ações da Reserva">
        <h2 className="text-lg font-semibold mb-1">
          {reservation.guest?.name} • {reservation.room?.title}
        </h2>
        <p className="text-sm mb-4 text-slate-600 dark:text-slate-300">
          {fmtBR(ci)} → {fmtBR(co)}
        </p>
        <div className="space-y-2">
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
            onClick={() => updateStatus("concluida")}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Expedia - cobrar limpeza
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg mt-4"
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
    </>
  );
}

function EditReservationModal({ open, onClose, reservation, rooms, onUpdated }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const [form, setForm] = useState({
    checkinDate: "",
    checkoutDate: "",
    roomId: "",
    notes: "",
  });

  useEffect(() => {
    if (reservation) {
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });

      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error("Erro ao editar reserva:", err);
      alert("Erro ao salvar alterações");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !reservation) return null;

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
            onApply={(ci, co) =>
              setForm((prev) => ({ ...prev, checkinDate: ci, checkoutDate: co }))
            }
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

function AddReservationModal({ open, onClose, rooms, onCreated }) {
  const api = useApi();
  const [guestName, setGuestName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkin, setCheckin] = useState(fmtISO(new Date()));
  const [checkout, setCheckout] = useState(fmtISO(addDays(new Date(), 1)));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const guest = await api("/guests", {
        method: "POST",
        body: JSON.stringify({ name: guestName }),
      });

      const created = await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          guestId: guest.id,
          roomId,
          checkinDate: checkin,
          checkoutDate: checkout,
          status: ReservationStatus.AGENDADA,
          notes,
        }),
      });

      onCreated(created);
      onClose();
      setGuestName("");
      setNotes("");
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar reserva");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova reserva">
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
  }, []);

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

  return (
    <div className="p-4 overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[30px] font-semibold text-slate-900 dark:text-slate-50">
          Mapa de Reservas
        </h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-500/20"
        >
          Adicionar reserva
        </button>
      </div>

      {/* Controle de datas */}
      <div className="flex items-center justify-center mb-3">
        <div className="flex items-stretch rounded-xl overflow-hidden shadow-sm border border-sky-600/60">
          <button
            onClick={goPrev}
            className="px-3 bg-sky-600 hover:bg-sky-700 text-white text-lg"
            title="30 dias anteriores"
          >
            ‹
          </button>
          <button
            onClick={() => startPickerRef.current?.showPicker?.()}
            className={`px-4 font-semibold border-x border-sky-500 text-sm ${isDark ? "bg-slate-950 text-sky-100" : "bg-white text-slate-800"
              }`}
            title="Alterar data inicial"
          >
            {`${fmtBR(start)} à ${fmtBR(endDisplay)}`}
          </button>
          <button
            onClick={goNext}
            className="px-3 bg-sky-600 hover:bg-sky-700 text-white text-lg"
            title="Próximos 30 dias"
          >
            ›
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto min-w-[900px] bg-white dark:bg-slate-900 shadow-sm dark:shadow-lg">
        {/* Cabeçalho topo */}
        <div
          className="grid sticky top-0 z-30"
          style={{
            gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
          }}
        >
          {/* Coluna UH / Mês */}
          <div
            className={`
              sticky left-0 z-40 h-12 px-3 text-sm flex items-center
              border-b border-slate-200 dark:border-slate-700
              font-medium tracking-wide
              ${isDark ? "bg-slate-950 text-sky-100" : "bg-sky-600 text-white"}
            `}
          >
            UH / Mês
          </div>

          {/* Linha de fundo (sem dias ainda) */}
          {Array.from({ length: days }).map((_, i) => (
            <div
              key={i}
              className={`h-12 border-b border-slate-200 dark:border-slate-700 ${isDark ? "bg-slate-950" : "bg-sky-600 to bg-sky-400"
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
                className="grid sticky top-10 z-20"
                style={{
                  gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
                }}
              >
                {/* Coluna Stay */}
                <div
                  className={`
                    sticky left-0 z-30 px-3 h-10 flex items-center cursor-pointer select-none
                    border-b border-slate-200 dark:border-slate-700 text-[13px] font-semibold
                    ${isDark
                      ? "bg-slate-900 text-slate-100"
                      : "bg-sky-100 text-slate-900"
                    }
                  `}
                  onClick={() => toggleGroup(stay)}
                >
                  <span className="mr-2">{isOpen ? "⌄" : "›"}</span>
                  {stay}
                </div>

                {/* Cabeçalhos dos dias */}
                {headerDays.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const baseBg = isDark
                    ? isWeekend
                      ? "bg-slate-800"
                      : "bg-slate-900"
                    : isWeekend
                      ? "bg-sky-100"
                      : "bg-sky-50";

                  return (
                    <div
                      key={i}
                      className={`h-10 flex flex-col justify-center items-center border-l border-b border-slate-200 dark:border-slate-700 ${baseBg}`}
                    >
                      <div className="text-[18px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
                        {pad2(d.getDate())}
                      </div>
                      <div className="text-[10px] uppercase leading-tight text-slate-600 dark:text-slate-300">
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
                    className="relative grid"
                    style={{
                      gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${days}, ${cellW}px)`,
                    }}
                  >
                    {/* Nome da UH */}
                    <div className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 text-sm border-b border-slate-200 dark:border-slate-700 h-10 flex items-center text-slate-800 dark:text-slate-100">
                      {room.title}
                    </div>

                    {/* Células de dias */}
                    {Array.from({ length: days }).map((_, i) => {
                      const d = headerDays[i];
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const bgClass = isDark
                        ? isWeekend
                          ? "bg-slate-800/60"
                          : "bg-slate-900"
                        : isWeekend
                          ? "bg-slate-50"
                          : "bg-white";

                      return (
                        <div
                          key={i}
                          className={`relative h-10 border-l border-b border-slate-200 dark:border-slate-800 ${bgClass}`}
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
                            onClick={setSelected}
                          />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <ReservationActionsModal
        open={!!selected}
        onClose={() => setSelected(null)}
        reservation={selected}
        rooms={rooms}
        onUpdated={(updated) =>
          setReservations((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          )
        }
      />

      <AddReservationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        rooms={rooms}
        onCreated={(res) => setReservations((prev) => [...prev, res])}
      />

      {loading && (
        <div className="mt-4 text-sm text-neutral-500 dark:text-slate-400">
          Carregando mapa...
        </div>
      )}
    </div>
  );
}

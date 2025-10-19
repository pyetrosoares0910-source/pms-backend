import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../lib/api";
import { DateRange } from "react-date-range";
import { addDays as addDaysFn, ptBR } from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

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
      return "bg-red-500";
    case ReservationStatus.CONCLUIDA:
      return "bg-emerald-600";
    case ReservationStatus.CANCELADA:
      return "bg-neutral-400";
    default:
      return "bg-blue-600";
  }
}

// ===== Modal base =====
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
function ReservationActionsModal({ open, onClose, reservation, onUpdated, rooms }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!open || !reservation) return null;

  async function updateStatus(newStatus) {
    setLoading(true);
    try {
      const updated = await api.put(`/reservations/${reservation.id}`, {
        status: newStatus,
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
        <h2 className="text-lg font-semibold mb-4">
          {reservation.guest?.name} • {reservation.room?.title}
        </h2>
        <p className="text-sm mb-4">
          {fmtBR(ci)} → {fmtBR(co)}
        </p>
        <div className="space-y-2">
          <button
            onClick={() => updateStatus("ativa")}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Fazer check-in
          </button>
          <button
            onClick={() => updateStatus("agendada")}
            disabled={loading}
            className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg"
          >
            Reverter check-in
          </button>
          <button
            onClick={() => updateStatus("concluida")}
            disabled={loading}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg"
          >
            Fazer check-out
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg mt-4"
          >
            Editar reserva
          </button>
          <button
            onClick={() => updateStatus("cancelada")}
            disabled={loading}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg"
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
  const [form, setForm] = useState({
    checkinDate: "",
    checkoutDate: "",
    roomId: "",
    notes: "",
  });

  // Range selecionado pelo usuário
  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: addDaysFn(new Date(), 1),
      key: "selection",
    },
  ]);

  // Quando abre o modal, preenche com os dados da reserva
  useEffect(() => {
    if (reservation) {
      const checkin = reservation.checkinDate
        ? new Date(reservation.checkinDate)
        : new Date();
      const checkout = reservation.checkoutDate
        ? new Date(reservation.checkoutDate)
        : addDaysFn(new Date(), 1);

      setForm({
        checkinDate: checkin.toISOString().split("T")[0],
        checkoutDate: checkout.toISOString().split("T")[0],
        roomId: reservation.roomId || "",
        notes: reservation.notes || "",
      });

      setRange([
        {
          startDate: checkin,
          endDate: checkout,
          key: "selection",
        },
      ]);
    }
  }, [reservation]);

  const handleRangeChange = (r) => {
    const { startDate, endDate } = r.selection;
    setRange([r.selection]);
    setForm((f) => ({
      ...f,
      checkinDate: startDate.toISOString().split("T")[0],
      checkoutDate: endDate.toISOString().split("T")[0],
    }));
  };

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
      <form onSubmit={handleSave} className="space-y-5">
        {/* 🗓️ Novo seletor de intervalo */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Selecione o intervalo de datas
          </label>
          <DateRange
            ranges={range}
            onChange={handleRangeChange}
            moveRangeOnFirstSelection={false}
            showDateDisplay={false}
            rangeColors={["#0284c7"]} // azul sky-600
            editableDateInputs={true}
            months={1}
            direction="horizontal"
            showMonthAndYearPickers={false}
            minDate={new Date(2020, 0, 1)}
            maxDate={addDaysFn(new Date(), 365)}
          />
          <div className="flex justify-between text-sm text-neutral-600 mt-2">
            <span>Check-in: {form.checkinDate}</span>
            <span>Check-out: {form.checkoutDate}</span>
          </div>
        </div>

        {/* Campos normais */}
        <div>
          <label className="text-sm font-medium">Quarto</label>
          <select
            name="roomId"
            value={form.roomId}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 mt-1"
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
          <label className="text-sm font-medium">Observações</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 mt-1"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
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
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estado do range (check-in / check-out)
  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: addDaysFn(new Date(), 1),
      key: "selection",
    },
  ]);

  const handleRangeChange = (r) => {
    setRange([r.selection]);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // cria o hóspede
      const guest = await api("/guests", {
        method: "POST",
        body: JSON.stringify({ name: guestName }),
      });

      // cria a reserva
      const created = await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          guestId: guest.id,
          roomId,
          checkinDate: range[0].startDate.toISOString().split("T")[0],
          checkoutDate: range[0].endDate.toISOString().split("T")[0],
          status: "agendada",
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

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Nova reserva">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nome do hóspede */}
        <div>
          <label className="text-sm">Hóspede</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />
        </div>

        {/* 🗓️ Calendário unificado */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Selecione o intervalo de datas
          </label>
          <DateRange
            ranges={range}
            onChange={handleRangeChange}
            moveRangeOnFirstSelection={false}
            showDateDisplay={false}
            rangeColors={["#0284c7"]}
            months={1}
            direction="horizontal"
            showMonthAndYearPickers={false}
            locale={ptBR} 
            minDate={new Date()}
            maxDate={addDaysFn(new Date(), 365)}
          />
          <div className="flex justify-between text-sm text-neutral-600 mt-2">
            <span>
              Check-in:{" "}
              {range[0].startDate.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
            <span>
              Check-out:{" "}
              {range[0].endDate.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Quarto */}
        <div>
          <label className="text-sm">Quarto</label>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2"
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

        {/* Observações */}
        <div>
          <label className="text-sm">Observações</label>
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
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
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const cellW = 45;
  const WINDOW_DAYS = 34; // 30 dias + 4 extras (fechando container)

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
        const [rms, resvs] = await Promise.all([
          api("/rooms"),
          api("/reservations"),
        ]);
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

  // Ordena as UHs pela posição definida no cadastro
  Object.values(map).forEach((group) => {
    group.rooms.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
  });

  // Ordena os empreendimentos pela posição do Stay
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
        <h1 className="text-[30px] font-semibold">Mapa de Reservas</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 rounded-xl bg-sky-700 text-white hover:bg-sky-700"
        >
          Adicionar reserva
        </button>
      </div>

      {/* Controle de datas */}
      <div className="flex items-center justify-center mb-3">
        <div className="flex items-stretch rounded-md overflow-hidden shadow">
          <button
            onClick={goPrev}
            className="px-3 bg-sky-700 text-white hover:bg-sky-700"
            title="30 dias anteriores"
          >
            ‹
          </button>
          <button
            onClick={() => startPickerRef.current?.showPicker?.()}
            className="px-4 bg-white border-y border-sky-700 text-slate-700 font-semibold"
            title="Alterar data inicial"
          >
            {`${fmtBR(start)} à ${fmtBR(endDisplay)}`}
          </button>
          <button
            onClick={goNext}
            className="px-3 bg-sky-700 text-white hover:bg-sky-950"
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



      <div className="rounded-2xl border border-neutral-200 overflow-x-auto min-w-[900px] bg-white">
  {/* Cabeçalho */}
  <div
  className="grid sticky top-0 z-30"
  style={{ gridTemplateColumns: `260px repeat(${days}, ${cellW}px)` }}
>
  {/* Coluna fixa UH / Mês com gradiente vertical */}
  <div className="bg-gradient-to-b from-sky-700 to-sky-900 border-b border-neutral-200 px-3 text-white text-sm sticky left-0 z-40 h-12 flex items-center">
    UH / Mês
  </div>

  {/* Linha contínua com gradiente vertical */}
  {Array.from({ length: days }).map((_, i) => (
    <div
      key={i}
      className="h-12 border-b border-neutral-200 
                 bg-gradient-to-b from-sky-700 to-sky-900"
    />
  ))}
</div>






  {/* Grupos */}
  {grouped.map(([stay, rows]) => {
    const isOpen = expandedGroups.has(stay);
    return (
      <div key={stay}>
        {/* Cabeçalho do empreendimento */}
        <div
  className="grid sticky top-10 z-20 bg-stone-50"
  style={{ gridTemplateColumns: `260px repeat(${days}, ${cellW}px)` }}
>
  {/* Coluna Stay */}
  <div
    className="sticky left-0 z-30 bg-sky-900 px-3 text-[13px] text-white font-semibold border-b border-neutral-200 h-10 flex items-center cursor-pointer select-none"
    onClick={() => toggleGroup(stay)}
  >
    <span className="mr-2">{isOpen ? "⌄" : "›"}</span>
    {stay}
  </div>

  {/* Colunas de dias */}
  {headerDays.map((d, i) => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return (
      <div
        key={i}
        className={`h-10 flex flex-col justify-center items-center border-l border-stone-200 border-b 
          ${isWeekend ? "bg-sky-900 text-white" : "bg-sky-900 text-white"}`}
      >
        {/* Dia numérico */}
        <div className="text-[18px] font-semibold leading-tight">
          {pad2(d.getDate())}
        </div>
        {/* Dia da semana */}
        <div className="text-[10px] uppercase leading-tight">
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
              style={{ gridTemplateColumns: `260px repeat(${days}, ${cellW}px)` }}
            >
              <div className="sticky left-0 z-10 bg-white px-3 text-sm border-b border-neutral-200 h-10 flex items-center">
                {room.title}
              </div>

              {Array.from({ length: days }).map((_, i) => {
                const d = headerDays[i];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`relative h-10 border-l border-stone-200 border-b 
                      ${isWeekend ? "bg-gray-100" : "bg-white"}`}
                  />
                );
              })}

              <div className="absolute left-[260px] right-0 top-0 bottom-0">
                {reservations
                  .filter(
                    (r) => r.roomId === room.id && r.status !== "cancelada"
                  )
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
    <div className="mt-4 text-sm text-neutral-500">Carregando mapa...</div>
  )}
</div>
  );
  }
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Eraser,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import api from "../api/axios";

const INITIAL_VISIBLE_LIMIT = 50;
const STATUS_OPTIONS = ["registrada", "agendada", "ativa", "concluida", "cancelada"];
const QUICK_FILTERS = [
  { id: "recent", label: "Recentes" },
  { id: "active", label: "Ativas" },
  { id: "future", label: "Futuras" },
  { id: "today", label: "Hoje" },
  { id: "changed", label: "Alteradas" },
];

const emptyForm = {
  guestId: "",
  roomId: "",
  checkinDate: "",
  checkoutDate: "",
  status: "registrada",
  notes: "",
};

const emptyFilters = {
  search: "",
  status: "all",
  stayId: "all",
  roomId: "all",
  dateField: "stay",
  dateFrom: "",
  dateTo: "",
  createdFrom: "",
  createdTo: "",
  onlyChanged: false,
  onlyCleaningChanged: false,
  onlyWithNotes: false,
};

function dateOnly(value) {
  return value ? String(value).split("T")[0] : "";
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const only = dateOnly(value);
  if (!only) return "-";
  const [year, month, day] = only.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getStayName(room) {
  return room?.stay?.name || "Sem stay";
}

function abbrevStay(name) {
  const map = {
    "Itaim Stay (Tabapua)": "Itaim",
    "Itaim Stay 2 (Tabapua)": "Itaim 2",
    "JK Stay (Clodomiro)": "JK",
    "Internacional Stay (Urussui)": "Internacional",
    "Iguatemi Stay A (Butanta)": "Iguatemi A",
    "Iguatemi Stay B (Butanta)": "Iguatemi B",
    "Estanconfor Vila Olimpia": "Vila Olimpia",
  };
  const normalized = normalizeText(name);
  const mapped = Object.entries(map).find(([key]) => normalizeText(key) === normalized);
  if (mapped) return mapped[1];
  return name?.split("(")[0]?.trim() || name || "Sem stay";
}

function hasMeaningfulUpdate(reservation) {
  const created = parseDate(reservation.createdAt);
  const updated = parseDate(reservation.updatedAt);
  if (!created || !updated) return false;
  return Math.abs(updated.getTime() - created.getTime()) > 60 * 1000;
}

function hasCleaningChange(reservation) {
  return Boolean(reservation.cleaningDateOverride);
}

function getNights(reservation) {
  const checkin = parseDate(reservation.checkinDate);
  const checkout = parseDate(reservation.checkoutDate);
  if (!checkin || !checkout) return null;
  const diff = checkout.getTime() - checkin.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function isBetweenDateOnly(value, from, to) {
  const only = dateOnly(value);
  if (!only) return false;
  if (from && only < from) return false;
  if (to && only > to) return false;
  return true;
}

function overlapsStay(reservation, from, to) {
  const checkin = dateOnly(reservation.checkinDate);
  const checkout = dateOnly(reservation.checkoutDate);
  if (!checkin || !checkout) return false;
  if (from && checkout < from) return false;
  if (to && checkin > to) return false;
  return true;
}

function buildSearchText(reservation) {
  return normalizeText(
    [
      reservation.id,
      reservation.guest?.name,
      reservation.guest?.phone,
      reservation.guest?.email,
      reservation.room?.title,
      getStayName(reservation.room),
      reservation.status,
      reservation.notes,
      reservation.cleaningChangeReason,
      dateOnly(reservation.checkinDate),
      dateOnly(reservation.checkoutDate),
    ].join(" ")
  );
}

function getStatusClass(status) {
  const classes = {
    registrada: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    agendada: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
    ativa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    concluida: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    cancelada: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  };
  return classes[status] || classes.registrada;
}

function sortedByCreatedDesc(items) {
  return [...items].sort((a, b) => {
    const createdDiff = (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0);
    if (createdDiff !== 0) return createdDiff;
    return (parseDate(b.checkinDate)?.getTime() || 0) - (parseDate(a.checkinDate)?.getTime() || 0);
  });
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">{value}</div>
    </div>
  );
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [quickFilter, setQuickFilter] = useState("recent");
  const [filters, setFilters] = useState(emptyFilters);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(emptyForm);

  const getApiErrorMessage = useCallback(
    (err, fallback) => err?.response?.data?.error || err?.message || fallback,
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resReservations, resGuests, resRooms] = await Promise.all([
        api.get("/reservations"),
        api.get("/guests"),
        api.get("/rooms"),
      ]);
      setReservations(Array.isArray(resReservations.data) ? resReservations.data : []);
      setGuests(Array.isArray(resGuests.data) ? resGuests.data : []);
      setRooms(Array.isArray(resRooms.data) ? resRooms.data : []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      alert(getApiErrorMessage(err, "Erro ao carregar reservas."));
    } finally {
      setLoading(false);
    }
  }, [getApiErrorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const roomOptions = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        `${getStayName(a)} ${a.title}`.localeCompare(`${getStayName(b)} ${b.title}`, "pt-BR")
      ),
    [rooms]
  );

  const guestOptions = useMemo(
    () => [...guests].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")),
    [guests]
  );

  const stayOptions = useMemo(() => {
    const stays = new Map();
    rooms.forEach((room) => {
      if (room.stay?.id) stays.set(room.stay.id, room.stay.name);
    });
    return [...stays.entries()].sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));
  }, [rooms]);

  const today = dateOnly(new Date().toISOString());

  const filteredReservations = useMemo(() => {
    const search = normalizeText(filters.search);

    return sortedByCreatedDesc(reservations).filter((reservation) => {
      if (quickFilter === "active" && reservation.status !== "ativa") return false;
      if (quickFilter === "future" && dateOnly(reservation.checkinDate) < today) return false;
      if (
        quickFilter === "today" &&
        !overlapsStay(reservation, today, today) &&
        !isBetweenDateOnly(reservation.checkoutDate, today, today)
      ) {
        return false;
      }
      if (quickFilter === "changed" && !hasMeaningfulUpdate(reservation) && !hasCleaningChange(reservation)) {
        return false;
      }

      if (filters.status !== "all" && reservation.status !== filters.status) return false;
      if (filters.stayId !== "all" && reservation.room?.stay?.id !== filters.stayId) return false;
      if (filters.roomId !== "all" && reservation.roomId !== filters.roomId) return false;
      if (filters.onlyChanged && !hasMeaningfulUpdate(reservation)) return false;
      if (filters.onlyCleaningChanged && !hasCleaningChange(reservation)) return false;
      if (filters.onlyWithNotes && !String(reservation.notes || "").trim()) return false;

      if (filters.dateFrom || filters.dateTo) {
        const matchesDate =
          filters.dateField === "checkin"
            ? isBetweenDateOnly(reservation.checkinDate, filters.dateFrom, filters.dateTo)
            : filters.dateField === "checkout"
              ? isBetweenDateOnly(reservation.checkoutDate, filters.dateFrom, filters.dateTo)
              : overlapsStay(reservation, filters.dateFrom, filters.dateTo);
        if (!matchesDate) return false;
      }

      if ((filters.createdFrom || filters.createdTo) && !isBetweenDateOnly(reservation.createdAt, filters.createdFrom, filters.createdTo)) {
        return false;
      }

      if (search && !buildSearchText(reservation).includes(search)) return false;
      return true;
    });
  }, [filters, quickFilter, reservations, today]);

  const hasActiveFilters = useMemo(
    () =>
      quickFilter !== "recent" ||
      Object.entries(filters).some(([key, value]) => {
        if (key === "dateField") return value !== "stay";
        if (typeof value === "boolean") return value;
        return value && value !== "all";
      }),
    [filters, quickFilter]
  );

  const visibleReservations = useMemo(() => {
    if (showAllResults || hasActiveFilters) return filteredReservations;
    return filteredReservations.slice(0, INITIAL_VISIBLE_LIMIT);
  }, [filteredReservations, hasActiveFilters, showAllResults]);

  const summary = useMemo(() => {
    const active = reservations.filter((reservation) => reservation.status === "ativa").length;
    const upcoming = reservations.filter((reservation) => dateOnly(reservation.checkinDate) >= today).length;
    const changed = reservations.filter(
      (reservation) => hasMeaningfulUpdate(reservation) || hasCleaningChange(reservation)
    ).length;
    return { total: reservations.length, active, upcoming, changed };
  }, [reservations, today]);

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      await api.post("/reservations", formData);
      setFormData(emptyForm);
      setShowCreateForm(false);
      fetchData();
    } catch (err) {
      console.error("Erro ao criar reserva:", err);
      alert(getApiErrorMessage(err, "Erro ao criar reserva."));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir esta reserva?")) return;
    try {
      await api.delete(`/reservations/${id}`);
      fetchData();
    } catch (err) {
      console.error("Erro ao excluir reserva:", err);
      alert(getApiErrorMessage(err, "Erro ao excluir reserva."));
    }
  };

  const handleEdit = (reservation) => {
    setEditId(reservation.id);
    setEditData({
      guestId: reservation.guestId || "",
      roomId: reservation.roomId || "",
      checkinDate: dateOnly(reservation.checkinDate),
      checkoutDate: dateOnly(reservation.checkoutDate),
      status: reservation.status || "registrada",
      notes: reservation.notes || "",
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData(emptyForm);
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/reservations/${id}`, editData);
      setEditId(null);
      fetchData();
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
      alert(getApiErrorMessage(err, "Erro ao atualizar reserva."));
    }
  };

  const clearFilters = () => {
    setQuickFilter("recent");
    setFilters(emptyFilters);
    setShowAllResults(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
        Carregando reservas...
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Busca rapida, filtros operacionais e detalhes completos das reservas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />}
          {showCreateForm ? "Fechar cadastro" : "Nova reserva"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatBox label="Total" value={summary.total} />
        <StatBox label="Ativas" value={summary.active} />
        <StatBox label="Futuras" value={summary.upcoming} />
        <StatBox label="Com alteracao" value={summary.changed} />
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-6"
        >
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.guestId}
            onChange={(event) => setFormData({ ...formData, guestId: event.target.value })}
            required
          >
            <option value="">Hospede</option>
            {guestOptions.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.roomId}
            onChange={(event) => setFormData({ ...formData, roomId: event.target.value })}
            required
          >
            <option value="">Acomodacao</option>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title} - {abbrevStay(getStayName(room))}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.checkinDate}
            onChange={(event) => setFormData({ ...formData, checkinDate: event.target.value })}
            required
          />

          <input
            type="date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.checkoutDate}
            onChange={(event) => setFormData({ ...formData, checkoutDate: event.target.value })}
            required
          />

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.status}
            onChange={(event) => setFormData({ ...formData, status: event.target.value })}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Plus size={16} />
            Cadastrar
          </button>

          <textarea
            className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 lg:col-span-6"
            value={formData.notes}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
            placeholder="Observacoes da reserva"
          />
        </form>
      )}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Buscar por hospede, telefone, quarto, stay, status, nota ou ID"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Todos status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={filters.stayId}
            onChange={(event) => setFilters({ ...filters, stayId: event.target.value, roomId: "all" })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Todos stays</option>
            {stayOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {abbrevStay(name)}
              </option>
            ))}
          </select>

          <select
            value={filters.roomId}
            onChange={(event) => setFilters({ ...filters, roomId: event.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Todos quartos</option>
            {roomOptions
              .filter((room) => filters.stayId === "all" || room.stay?.id === filters.stayId)
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title} - {abbrevStay(getStayName(room))}
                </option>
              ))}
          </select>

          <select
            value={filters.dateField}
            onChange={(event) => setFilters({ ...filters, dateField: event.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="stay">Periodo da estadia</option>
            <option value="checkin">Check-in</option>
            <option value="checkout">Check-out</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Eraser size={16} />
            Limpar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Data inicial
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Data final
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Criada de
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(event) => setFilters({ ...filters, createdFrom: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Criada ate
            <input
              type="date"
              value={filters.createdTo}
              onChange={(event) => setFilters({ ...filters, createdTo: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setQuickFilter(filter.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                quickFilter === filter.id
                  ? "bg-sky-700 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {filter.label}
            </button>
          ))}

          {[
            ["onlyChanged", "Com ultima alteracao"],
            ["onlyCleaningChanged", "Limpeza alterada"],
            ["onlyWithNotes", "Com observacao"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
            >
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(event) => setFilters({ ...filters, [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <div className="font-semibold text-slate-950 dark:text-slate-50">
              {visibleReservations.length} de {filteredReservations.length} reserva(s)
            </div>
            {!hasActiveFilters && !showAllResults && filteredReservations.length > INITIAL_VISIBLE_LIMIT ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Exibindo as ultimas {INITIAL_VISIBLE_LIMIT} reservas criadas.
              </div>
            ) : null}
          </div>
          {!hasActiveFilters && filteredReservations.length > INITIAL_VISIBLE_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAllResults((value) => !value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"
            >
              {showAllResults ? "Mostrar 50" : "Mostrar todas"}
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Reserva</th>
                <th className="px-4 py-3">Hospede</th>
                <th className="px-4 py-3">Acomodacao</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Limpeza</th>
                <th className="px-4 py-3">Historico</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleReservations.map((reservation) => {
                const isEditing = editId === reservation.id;
                const nights = getNights(reservation);

                if (isEditing) {
                  return (
                    <tr key={reservation.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                      <td className="px-4 py-3 text-xs text-slate-500">{reservation.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                          value={editData.guestId}
                          onChange={(event) => setEditData({ ...editData, guestId: event.target.value })}
                        >
                          {guestOptions.map((guest) => (
                            <option key={guest.id} value={guest.id}>
                              {guest.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                          value={editData.roomId}
                          onChange={(event) => setEditData({ ...editData, roomId: event.target.value })}
                        >
                          {roomOptions.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.title} - {abbrevStay(getStayName(room))}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          <input
                            type="date"
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                            value={editData.checkinDate}
                            onChange={(event) => setEditData({ ...editData, checkinDate: event.target.value })}
                          />
                          <input
                            type="date"
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                            value={editData.checkoutDate}
                            onChange={(event) => setEditData({ ...editData, checkoutDate: event.target.value })}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3" colSpan={2}>
                        <textarea
                          className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                          value={editData.notes}
                          onChange={(event) => setEditData({ ...editData, notes: event.target.value })}
                          placeholder="Observacoes"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                          value={editData.status}
                          onChange={(event) => setEditData({ ...editData, status: event.target.value })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(reservation.id)}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={reservation.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        <ClipboardList size={16} className="text-slate-400" />
                        {reservation.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {reservation.notes ? reservation.notes : "Sem observacao"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {reservation.guest?.name || "Hospede sem nome"}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <div>{reservation.guest?.phone || "Sem telefone"}</div>
                        <div>{reservation.guest?.email || "Sem email"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{reservation.room?.title || "Sem acomodacao"}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {abbrevStay(getStayName(reservation.room))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        <CalendarDays size={16} className="text-slate-400" />
                        {formatDate(reservation.checkinDate)} ate {formatDate(reservation.checkoutDate)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {nights === null ? "Noites nao calculadas" : `${nights} noite(s)`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {formatDate(reservation.cleaningDateOverride || reservation.checkoutDate)}
                      </div>
                      {reservation.cleaningDateOverride ? (
                        <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                          Alterada: {reservation.cleaningChangeReason || "Motivo nao informado"}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Data do check-out</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <div>Criada: {formatDateTime(reservation.createdAt)}</div>
                      <div className="mt-1">
                        Ultima alteracao:{" "}
                        {hasMeaningfulUpdate(reservation) ? formatDateTime(reservation.updatedAt) : "sem alteracao"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold uppercase ${getStatusClass(reservation.status)}`}>
                        {reservation.status || "sem status"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(reservation)}
                          className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(reservation.id)}
                          className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visibleReservations.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma reserva encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

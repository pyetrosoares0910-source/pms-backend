import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eraser,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import api from "../api/axios";

const INITIAL_VISIBLE_LIMIT = 50;
const QUICK_FILTERS = [
  { id: "recent", label: "Recentes" },
  { id: "active", label: "Hospedados" },
  { id: "future", label: "Com futuras" },
  { id: "repeat", label: "Recorrentes" },
  { id: "missing", label: "Cadastro incompleto" },
  { id: "changed", label: "Alterados" },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
};

const emptyFilters = {
  search: "",
  stayId: "all",
  roomId: "all",
  reservationStatus: "all",
  createdFrom: "",
  createdTo: "",
  stayFrom: "",
  stayTo: "",
  onlyWithEmail: false,
  onlyWithPhone: false,
  onlyWithReservations: false,
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

function hasMeaningfulUpdate(item) {
  const created = parseDate(item.createdAt);
  const updated = parseDate(item.updatedAt);
  if (!created || !updated) return false;
  return Math.abs(updated.getTime() - created.getTime()) > 60 * 1000;
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

function sortGuestsByCreatedDesc(items) {
  return [...items].sort((a, b) => {
    const createdDiff = (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0);
    if (createdDiff !== 0) return createdDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

function getGuestReservationSummary(reservations, today) {
  const active = reservations.filter((reservation) => reservation.status !== "cancelada" && overlapsStay(reservation, today, today));
  const future = reservations
    .filter((reservation) => reservation.status !== "cancelada" && dateOnly(reservation.checkinDate) >= today)
    .sort((a, b) => String(a.checkinDate).localeCompare(String(b.checkinDate)));
  const past = reservations
    .filter((reservation) => dateOnly(reservation.checkoutDate) < today)
    .sort((a, b) => String(b.checkoutDate).localeCompare(String(a.checkoutDate)));

  return {
    total: reservations.length,
    active,
    future,
    past,
    latest: [...reservations].sort((a, b) => String(b.checkinDate).localeCompare(String(a.checkinDate)))[0] || null,
    next: future[0] || null,
    last: past[0] || null,
  };
}

function buildGuestSearchText(guest, reservations) {
  const reservationText = reservations
    .map((reservation) =>
      [
        reservation.status,
        reservation.room?.title,
        getStayName(reservation.room),
        reservation.notes,
        dateOnly(reservation.checkinDate),
        dateOnly(reservation.checkoutDate),
      ].join(" ")
    )
    .join(" ");

  return normalizeText(
    [
      guest.id,
      guest.name,
      guest.email,
      guest.phone,
      formatPhone(guest.phone),
      reservationText,
    ].join(" ")
  );
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value || "";
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

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [reservations, setReservations] = useState([]);
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
      const [guestsRes, reservationsRes, roomsRes] = await Promise.all([
        api.get("/guests"),
        api.get("/reservations"),
        api.get("/rooms"),
      ]);
      setGuests(Array.isArray(guestsRes.data) ? guestsRes.data : []);
      setReservations(Array.isArray(reservationsRes.data) ? reservationsRes.data : []);
      setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar hospedes:", err);
      alert(getApiErrorMessage(err, "Erro ao carregar hospedes."));
    } finally {
      setLoading(false);
    }
  }, [getApiErrorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = dateOnly(new Date().toISOString());

  const reservationsByGuest = useMemo(() => {
    const grouped = new Map();
    reservations.forEach((reservation) => {
      if (!grouped.has(reservation.guestId)) grouped.set(reservation.guestId, []);
      grouped.get(reservation.guestId).push(reservation);
    });
    return grouped;
  }, [reservations]);

  const roomOptions = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        `${getStayName(a)} ${a.title}`.localeCompare(`${getStayName(b)} ${b.title}`, "pt-BR")
      ),
    [rooms]
  );

  const stayOptions = useMemo(() => {
    const stays = new Map();
    rooms.forEach((room) => {
      if (room.stay?.id) stays.set(room.stay.id, room.stay.name);
    });
    return [...stays.entries()].sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));
  }, [rooms]);

  const statusOptions = useMemo(
    () => [...new Set(reservations.map((reservation) => reservation.status).filter(Boolean))].sort(),
    [reservations]
  );

  const enrichedGuests = useMemo(
    () =>
      sortGuestsByCreatedDesc(guests).map((guest) => {
        const guestReservations = reservationsByGuest.get(guest.id) || [];
        return {
          ...guest,
          reservations: guestReservations,
          reservationSummary: getGuestReservationSummary(guestReservations, today),
        };
      }),
    [guests, reservationsByGuest, today]
  );

  const filteredGuests = useMemo(() => {
    const search = normalizeText(filters.search);

    return enrichedGuests.filter((guest) => {
      const guestReservations = guest.reservations || [];
      const summary = guest.reservationSummary;

      if (quickFilter === "active" && summary.active.length === 0) return false;
      if (quickFilter === "future" && summary.future.length === 0) return false;
      if (quickFilter === "repeat" && summary.total < 2) return false;
      if (quickFilter === "missing" && guest.email && guest.phone) return false;
      if (quickFilter === "changed" && !hasMeaningfulUpdate(guest)) return false;

      if (filters.onlyWithEmail && !guest.email) return false;
      if (filters.onlyWithPhone && !guest.phone) return false;
      if (filters.onlyWithReservations && summary.total === 0) return false;

      if ((filters.createdFrom || filters.createdTo) && !isBetweenDateOnly(guest.createdAt, filters.createdFrom, filters.createdTo)) {
        return false;
      }

      const reservationFiltersActive =
        filters.stayId !== "all" ||
        filters.roomId !== "all" ||
        filters.reservationStatus !== "all" ||
        filters.stayFrom ||
        filters.stayTo;

      if (reservationFiltersActive) {
        const hasMatchingReservation = guestReservations.some((reservation) => {
          if (filters.stayId !== "all" && reservation.room?.stay?.id !== filters.stayId) return false;
          if (filters.roomId !== "all" && reservation.roomId !== filters.roomId) return false;
          if (filters.reservationStatus !== "all" && reservation.status !== filters.reservationStatus) return false;
          if ((filters.stayFrom || filters.stayTo) && !overlapsStay(reservation, filters.stayFrom, filters.stayTo)) {
            return false;
          }
          return true;
        });
        if (!hasMatchingReservation) return false;
      }

      if (search && !buildGuestSearchText(guest, guestReservations).includes(search)) return false;
      return true;
    });
  }, [enrichedGuests, filters, quickFilter]);

  const hasActiveFilters = useMemo(
    () =>
      quickFilter !== "recent" ||
      Object.values(filters).some((value) => {
        if (typeof value === "boolean") return value;
        return value && value !== "all";
      }),
    [filters, quickFilter]
  );

  const visibleGuests = useMemo(() => {
    if (showAllResults || hasActiveFilters) return filteredGuests;
    return filteredGuests.slice(0, INITIAL_VISIBLE_LIMIT);
  }, [filteredGuests, hasActiveFilters, showAllResults]);

  const summary = useMemo(() => {
    const withReservations = enrichedGuests.filter((guest) => guest.reservationSummary.total > 0).length;
    const active = enrichedGuests.filter((guest) => guest.reservationSummary.active.length > 0).length;
    const future = enrichedGuests.filter((guest) => guest.reservationSummary.future.length > 0).length;
    const incomplete = enrichedGuests.filter((guest) => !guest.email || !guest.phone).length;
    return { total: guests.length, withReservations, active, future, incomplete };
  }, [enrichedGuests, guests.length]);

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      await api.post("/guests", formData);
      setFormData(emptyForm);
      setShowCreateForm(false);
      fetchData();
    } catch (err) {
      console.error("Erro ao criar hospede:", err);
      alert(getApiErrorMessage(err, "Erro ao criar hospede."));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deseja realmente excluir este hospede?")) return;
    try {
      await api.delete(`/guests/${id}`);
      fetchData();
    } catch (err) {
      console.error("Erro ao excluir hospede:", err);
      alert(getApiErrorMessage(err, "Erro ao excluir hospede."));
    }
  };

  const handleEdit = (guest) => {
    setEditId(guest.id);
    setEditData({
      name: guest.name || "",
      email: guest.email || "",
      phone: guest.phone || "",
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData(emptyForm);
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/guests/${id}`, editData);
      setEditId(null);
      fetchData();
    } catch (err) {
      console.error("Erro ao atualizar hospede:", err);
      alert(getApiErrorMessage(err, "Erro ao atualizar hospede."));
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
        Carregando hospedes...
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hospedes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cadastro pesquisavel com contexto de reservas, estadias e contatos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />}
          {showCreateForm ? "Fechar cadastro" : "Novo hospede"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <StatBox label="Total" value={summary.total} />
        <StatBox label="Com reservas" value={summary.withReservations} />
        <StatBox label="Hospedados" value={summary.active} />
        <StatBox label="Com futuras" value={summary.future} />
        <StatBox label="Incompletos" value={summary.incomplete} />
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-4"
        >
          <input
            type="text"
            placeholder="Nome"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            required
          />

          <input
            type="email"
            placeholder="Email"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.email}
            onChange={(event) => setFormData({ ...formData, email: event.target.value })}
          />

          <input
            type="text"
            placeholder="Telefone"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={formData.phone}
            onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
          />

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Plus size={16} />
            Cadastrar
          </button>
        </form>
      )}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Buscar por nome, email, telefone, ID, quarto, stay ou data"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

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
            value={filters.reservationStatus}
            onChange={(event) => setFilters({ ...filters, reservationStatus: event.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Todos status reserva</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:col-start-6"
          >
            <Eraser size={16} />
            Limpar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Criado de
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(event) => setFilters({ ...filters, createdFrom: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Criado ate
            <input
              type="date"
              value={filters.createdTo}
              onChange={(event) => setFilters({ ...filters, createdTo: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Estadia de
            <input
              type="date"
              value={filters.stayFrom}
              onChange={(event) => setFilters({ ...filters, stayFrom: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Estadia ate
            <input
              type="date"
              value={filters.stayTo}
              onChange={(event) => setFilters({ ...filters, stayTo: event.target.value })}
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
            ["onlyWithEmail", "Com email"],
            ["onlyWithPhone", "Com telefone"],
            ["onlyWithReservations", "Com reservas"],
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
              {visibleGuests.length} de {filteredGuests.length} hospede(s)
            </div>
            {!hasActiveFilters && !showAllResults && filteredGuests.length > INITIAL_VISIBLE_LIMIT ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Exibindo os ultimos {INITIAL_VISIBLE_LIMIT} hospedes cadastrados.
              </div>
            ) : null}
          </div>
          {!hasActiveFilters && filteredGuests.length > INITIAL_VISIBLE_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAllResults((value) => !value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"
            >
              {showAllResults ? "Mostrar 50" : "Mostrar todos"}
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Hospede</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Reservas</th>
                <th className="px-4 py-3">Status atual</th>
                <th className="px-4 py-3">Proxima/ultima estadia</th>
                <th className="px-4 py-3">Historico</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleGuests.map((guest) => {
                const isEditing = editId === guest.id;
                const summaryData = guest.reservationSummary;
                const currentReservation = summaryData.active[0] || null;
                const referenceReservation = summaryData.next || summaryData.last || summaryData.latest;

                if (isEditing) {
                  return (
                    <tr key={guest.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                          value={editData.name}
                          onChange={(event) => setEditData({ ...editData, name: event.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          <input
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                            value={editData.email}
                            onChange={(event) => setEditData({ ...editData, email: event.target.value })}
                            placeholder="Email"
                          />
                          <input
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                            value={editData.phone}
                            onChange={(event) => setEditData({ ...editData, phone: event.target.value })}
                            placeholder="Telefone"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500" colSpan={4}>
                        As reservas vinculadas continuam sendo gerenciadas em /reservations.
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(guest.id)}
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
                  <tr key={guest.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        <UserRound size={16} className="text-slate-400" />
                        {guest.name || "Hospede sem nome"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ID {guest.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" />
                          {guest.email || "Sem email"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          {formatPhone(guest.phone) || "Sem telefone"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{summaryData.total} reserva(s)</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {summaryData.future.length} futura(s), {summaryData.past.length} passada(s)
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {currentReservation ? (
                        <div>
                          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold uppercase ${getStatusClass(currentReservation.status)}`}>
                            hospedado
                          </span>
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {currentReservation.room?.title} - {abbrevStay(getStayName(currentReservation.room))}
                          </div>
                        </div>
                      ) : summaryData.next ? (
                        <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold uppercase text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                          futura
                        </span>
                      ) : summaryData.total > 0 ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          historico
                        </span>
                      ) : (
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                          sem reserva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {referenceReservation ? (
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <CalendarDays size={16} className="text-slate-400" />
                            {formatDate(referenceReservation.checkinDate)} ate {formatDate(referenceReservation.checkoutDate)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {referenceReservation.room?.title || "Sem acomodacao"} - {abbrevStay(getStayName(referenceReservation.room))}
                          </div>
                          <div className="mt-1">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${getStatusClass(referenceReservation.status)}`}>
                              {referenceReservation.status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Nenhuma estadia vinculada</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <div>Criado: {formatDateTime(guest.createdAt)}</div>
                      <div className="mt-1">
                        Ultima alteracao: {hasMeaningfulUpdate(guest) ? formatDateTime(guest.updatedAt) : "sem alteracao"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(guest)}
                          className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(guest.id)}
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

              {visibleGuests.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Nenhum hospede encontrado com os filtros atuais.
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

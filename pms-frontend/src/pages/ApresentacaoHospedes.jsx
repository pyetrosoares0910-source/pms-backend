import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";
import {
  compareRoomsInMapOrder,
  formatDate,
  formatFullDate,
  getGenderKey,
  getPresentationMessages,
  inferGender,
  sortReservations,
} from "./guestPresentationShared";

dayjs.extend(utc);

const SETTINGS_KEY = "guest-checkins-settings-v2";

function getStoredPresentationSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { hostName: "Pyetro", genderOverrides: {} };
    const parsed = JSON.parse(raw);
    return {
      hostName: parsed.hostName || "Pyetro",
      genderOverrides: parsed.genderOverrides || {},
    };
  } catch {
    return { hostName: "Pyetro", genderOverrides: {} };
  }
}

function savePresentationSettings(patch) {
  const current = getStoredPresentationSettings();
  const raw = localStorage.getItem(SETTINGS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  const next = {
    ...parsed,
    ...current,
    ...patch,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function getReservationRoomKey(reservation) {
  return (
    reservation.room?.id ||
    `${reservation.room?.stay?.name || "sem-stay"}|${reservation.room?.title || reservation.id}`
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const classes =
    normalized === "registrada"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
      : normalized === "agendada"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
      : normalized === "ativa"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : normalized === "concluida"
      ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
      : normalized === "cancelada"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  const label =
    normalized === "registrada"
      ? "Registrada"
      : normalized === "agendada"
      ? "Agendada"
      : normalized === "ativa"
      ? "Ativa"
      : normalized === "concluida"
      ? "Concluida"
      : normalized === "cancelada"
      ? "Cancelada"
      : status;

  return (
    <span
      className={`inline-flex min-w-[112px] items-center justify-center rounded-full px-3 py-1 text-center text-xs font-semibold uppercase ${classes}`}
    >
      {label}
    </span>
  );
}

function MessageBlock({ text, label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] dark:border-slate-700"
        >
          Copiar
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </div>
  );
}

export default function ApresentacaoHospedes() {
  const api = useApi();
  const today = dayjs().format("YYYY-MM-DD");

  const [presentationStartDate, setPresentationStartDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(() => getStoredPresentationSettings());
  const [submittingId, setSubmittingId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reservationsRes, roomsRes] = await Promise.all([api("/reservations"), api("/rooms")]);
        setReservations(reservationsRes || []);
        setRooms(roomsRes || []);
      } catch (err) {
        console.error("Erro ao carregar apresentacoes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const presentationEndDate = useMemo(
    () => dayjs(presentationStartDate).add(7, "day").format("YYYY-MM-DD"),
    [presentationStartDate]
  );

  const roomMetaById = useMemo(
    () =>
      rooms.reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms]
  );

  const weeklyPresentationReservations = useMemo(() => {
    const start = dayjs(presentationStartDate).startOf("day");
    const end = dayjs(presentationStartDate).add(7, "day").endOf("day");
    return sortReservations(
      reservations.filter((reservation) => {
        if (reservation.status === "cancelada" || !reservation.checkinDate) return false;
        const checkin = dayjs.utc(reservation.checkinDate);
        return (
          checkin.isAfter(start.subtract(1, "millisecond")) &&
          checkin.isBefore(end.add(1, "millisecond"))
        );
      }),
      roomMetaById
    );
  }, [presentationStartDate, reservations, roomMetaById]);

  const groupedWeeklyPresentations = useMemo(() => {
    const groups = new Map();

    weeklyPresentationReservations.forEach((reservation) => {
      const stayName = reservation.room?.stay?.name || "Sem empreendimento";
      const roomKey = getReservationRoomKey(reservation);
      const roomName = reservation.room?.title || "Sem acomodacao";

      if (!groups.has(stayName)) {
        groups.set(stayName, { stayName, rooms: new Map() });
      }

      const stayGroup = groups.get(stayName);
      if (!stayGroup.rooms.has(roomKey)) {
        stayGroup.rooms.set(roomKey, { roomKey, roomName, items: [] });
      }

      stayGroup.rooms.get(roomKey).items.push(reservation);
    });

    const ordered = [...groups.values()].map((stayGroup) => ({
      stayName: stayGroup.stayName,
      rooms: [...stayGroup.rooms.values()],
    }));

    return ordered
      .map((stayGroup) => ({
        ...stayGroup,
        rooms: [...stayGroup.rooms].sort((a, b) => {
          const roomA = roomMetaById[a.items[0]?.roomId] || a.items[0]?.room || {};
          const roomB = roomMetaById[b.items[0]?.roomId] || b.items[0]?.room || {};
          return compareRoomsInMapOrder(roomA, roomB);
        }),
      }))
      .sort((a, b) => {
        const roomA = roomMetaById[a.rooms[0]?.items[0]?.roomId] || a.rooms[0]?.items[0]?.room || {};
        const roomB = roomMetaById[b.rooms[0]?.items[0]?.roomId] || b.rooms[0]?.items[0]?.room || {};
        return compareRoomsInMapOrder(roomA, roomB);
      });
  }, [weeklyPresentationReservations, roomMetaById]);

  const weeklyPresentationSummary = useMemo(() => {
    const total = weeklyPresentationReservations.length;
    const pending = weeklyPresentationReservations.filter(
      (reservation) => String(reservation.status || "").toLowerCase() === "registrada"
    ).length;
    const completed = total - pending;

    return { total, pending, completed };
  }, [weeklyPresentationReservations]);

  const handleSettingChange = (field, value) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      savePresentationSettings(next);
      return next;
    });
  };

  const handleGenderOverride = (reservation, value) => {
    const key = getGenderKey(reservation);
    setSettings((prev) => {
      const next = {
        ...prev,
        genderOverrides: {
          ...prev.genderOverrides,
          [key]: value,
        },
      };
      savePresentationSettings(next);
      return next;
    });
  };

  const updateReservationStatus = async (reservation, newStatus) => {
    setSubmittingId(reservation.id);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      setReservations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
      alert("Erro ao atualizar status da reserva.");
    } finally {
      setSubmittingId(null);
    }
  };

  const renderReservationCard = (reservation) => {
    const genderValue =
      settings.genderOverrides[getGenderKey(reservation)] || inferGender(reservation.guest?.name);
    const isPending = reservation.status === "registrada";

    return (
      <article
        key={reservation.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {reservation.guest?.name || "Hospede sem nome"}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {formatDate(reservation.checkinDate)} a {formatDate(reservation.checkoutDate)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={reservation.status} />
            <select
              value={genderValue}
              onChange={(e) => handleGenderOverride(reservation, e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="feminine">Texto feminino</option>
              <option value="masculine">Texto masculino</option>
            </select>
            <button
              type="button"
              onClick={() => updateReservationStatus(reservation, "agendada")}
              disabled={!isPending || submittingId === reservation.id}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                isPending
                  ? "bg-sky-700 hover:bg-sky-800"
                  : "cursor-not-allowed bg-slate-500 hover:bg-slate-500"
              }`}
            >
              {submittingId === reservation.id
                ? "Salvando..."
                : isPending
                ? "Confirmar enviada"
                : "Apresentacao enviada"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {getPresentationMessages(reservation, settings).map((text, index) => (
            <MessageBlock
              key={`${reservation.id}-presentation-${index}`}
              text={text}
              label={`Mensagem ${index + 1}`}
            />
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apresentacao hospedes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Mensagens de apresentacao da semana, ordenadas como no mapa.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Responsavel
          </div>
          <input
            value={settings.hostName}
            onChange={(e) => handleSettingChange("hostName", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Inicio apresentacoes
          </div>
          <input
            type="date"
            value={presentationStartDate}
            onChange={(e) => setPresentationStartDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando apresentacoes...
        </div>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="mb-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Concluidas
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {weeklyPresentationSummary.completed}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500 dark:text-rose-300">
                  Pendentes
                </div>
                <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-300">
                  {weeklyPresentationSummary.pending}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Total da semana
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {weeklyPresentationSummary.total}
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                weeklyPresentationSummary.pending > 0
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
              }`}
            >
              {weeklyPresentationSummary.pending > 0
                ? `Alerta: ${weeklyPresentationSummary.pending} apresentação(ões) ainda pendente(s) na semana.`
                : "Tudo certo: todas as apresentações da semana foram concluídas."}
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Apresentacoes da semana
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Janela de {formatFullDate(presentationStartDate)} ate {formatFullDate(presentationEndDate)}
            </p>
          </div>

          {groupedWeeklyPresentations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nenhuma reserva com check-in dentro desta janela de 8 dias.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedWeeklyPresentations.map((stayGroup) => (
                <div key={stayGroup.stayName} className="space-y-4">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {stayGroup.stayName}
                  </div>

                  {stayGroup.rooms.map((roomGroup) => (
                    <div
                      key={roomGroup.roomKey}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {roomGroup.roomName}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Entradas: {roomGroup.items.map((item) => formatDate(item.checkinDate)).join(", ")}
                          </div>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                          {roomGroup.items.length} check-in(s)
                        </div>
                      </div>

                      <div className="mt-4 space-y-5">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                            <span>Pendentes</span>
                            <span>
                              {
                                roomGroup.items.filter((reservation) => reservation.status === "registrada")
                                  .length
                              }
                            </span>
                          </div>

                          {roomGroup.items.some((reservation) => reservation.status === "registrada") ? (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                              {roomGroup.items
                                .filter((reservation) => reservation.status === "registrada")
                                .map(renderReservationCard)}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Nenhuma apresentacao pendente para esta acomodacao.
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                            <span>Enviadas</span>
                            <span>
                              {
                                roomGroup.items.filter((reservation) => reservation.status !== "registrada")
                                  .length
                              }
                            </span>
                          </div>

                          {roomGroup.items.some((reservation) => reservation.status !== "registrada") ? (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                              {roomGroup.items
                                .filter((reservation) => reservation.status !== "registrada")
                                .map(renderReservationCard)}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Nenhuma apresentacao enviada para esta acomodacao.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

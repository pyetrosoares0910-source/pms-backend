import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";
import {
  compareRoomsInMapOrder,
  formatDate,
  formatFullDate,
  getGenderKey,
  getPresentationGuestGroupKey,
  getPresentationMessages,
  getPresentationStayKey,
  getWeekStartMonday,
  inferGender,
  isPendingPresentationReservation,
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

function buildPresentationGroupKey(stayKey, guestKey) {
  return `${stayKey}::${guestKey}`;
}

function formatJoinedLabels(values) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
}

function getGroupRoomNames(items) {
  const labels = [];
  const seen = new Set();

  items.forEach((reservation) => {
    const roomKey = reservation.room?.id || reservation.room?.title || reservation.id;
    if (seen.has(roomKey)) return;

    seen.add(roomKey);
    labels.push(reservation.room?.title || "Sem acomodacao");
  });

  return formatJoinedLabels(labels);
}

function hasSameReservationPeriod(items) {
  if (items.length <= 1) return true;

  const firstCheckin = dayjs.utc(items[0]?.checkinDate);
  const firstCheckout = dayjs.utc(items[0]?.checkoutDate);

  return items.every(
    (reservation) =>
      dayjs.utc(reservation.checkinDate).isSame(firstCheckin, "day") &&
      dayjs.utc(reservation.checkoutDate).isSame(firstCheckout, "day")
  );
}

function formatReservationPeriod(reservation) {
  return `${formatDate(reservation.checkinDate)} a ${formatDate(reservation.checkoutDate)}`;
}

function getGroupDateSummary(items) {
  if (items.length === 0) return "";
  if (hasSameReservationPeriod(items)) return formatReservationPeriod(items[0]);

  return items
    .map(
      (reservation) =>
        `${reservation.room?.title || "Sem acomodacao"}: ${formatReservationPeriod(reservation)}`
    )
    .join(" | ");
}

function StatusBadge({ status, compact = false }) {
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
      className={`inline-flex items-center justify-center rounded-full text-center font-semibold uppercase ${classes} ${
        compact ? "px-2.5 py-1 text-[11px]" : "min-w-[112px] px-3 py-1 text-xs"
      }`}
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
  const today = dayjs();
  const defaultWeekStart = getWeekStartMonday(today).format("YYYY-MM-DD");

  const [presentationStartDate, setPresentationStartDate] = useState(defaultWeekStart);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(() => getStoredPresentationSettings());
  const [submittingId, setSubmittingId] = useState(null);
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const [expandedSentCards, setExpandedSentCards] = useState({});

  const normalizedStartDate = useMemo(
    () => getWeekStartMonday(presentationStartDate).format("YYYY-MM-DD"),
    [presentationStartDate]
  );

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
    () => dayjs(normalizedStartDate).add(8, "day").format("YYYY-MM-DD"),
    [normalizedStartDate]
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
    const start = dayjs.utc(normalizedStartDate).startOf("day");
    const end = dayjs.utc(normalizedStartDate).add(8, "day").endOf("day");
    return sortReservations(
      reservations.filter((reservation) => {
        if (reservation.status === "cancelada" || !reservation.checkinDate) return false;
        const checkin = dayjs.utc(reservation.checkinDate);
        return checkin.isBetween(start, end, null, "[]");
      }),
      roomMetaById
    );
  }, [normalizedStartDate, reservations, roomMetaById]);

  const groupedWeeklyPresentations = useMemo(() => {
    const groups = new Map();

    weeklyPresentationReservations.forEach((reservation) => {
      const stayKey = getPresentationStayKey(reservation);
      const stayName = reservation.room?.stay?.name || "Sem empreendimento";
      const guestKey = getPresentationGuestGroupKey(reservation);

      if (!groups.has(stayKey)) {
        groups.set(stayKey, {
          stayKey,
          stayName,
          presentationGroups: new Map(),
        });
      }

      const stayGroup = groups.get(stayKey);
      if (!stayGroup.presentationGroups.has(guestKey)) {
        stayGroup.presentationGroups.set(guestKey, {
          guestKey,
          groupKey: buildPresentationGroupKey(stayKey, guestKey),
          items: [],
        });
      }

      stayGroup.presentationGroups.get(guestKey).items.push(reservation);
    });

    return [...groups.values()]
      .map((stayGroup) => {
        const presentationGroups = [...stayGroup.presentationGroups.values()]
          .map((presentationGroup) => {
            const items = sortReservations(presentationGroup.items, roomMetaById);
            const pendingItems = items.filter((reservation) =>
              isPendingPresentationReservation(reservation)
            );
            const sentItems = items.filter(
              (reservation) => !isPendingPresentationReservation(reservation)
            );

            return {
              ...presentationGroup,
              items,
              pendingItems,
              sentItems,
              primaryReservation: items[0],
              roomNames: getGroupRoomNames(items),
              dateSummary: getGroupDateSummary(items),
              samePeriod: hasSameReservationPeriod(items),
              roomCount: new Set(
                items.map(
                  (reservation) =>
                    reservation.room?.id || reservation.room?.title || reservation.id
                )
              ).size,
            };
          })
          .sort((a, b) => {
            const roomA =
              roomMetaById[a.primaryReservation?.roomId] || a.primaryReservation?.room || {};
            const roomB =
              roomMetaById[b.primaryReservation?.roomId] || b.primaryReservation?.room || {};
            const roomCompare = compareRoomsInMapOrder(roomA, roomB);
            if (roomCompare !== 0) return roomCompare;

            const checkinCompare =
              dayjs.utc(a.primaryReservation?.checkinDate).valueOf() -
              dayjs.utc(b.primaryReservation?.checkinDate).valueOf();
            if (checkinCompare !== 0) return checkinCompare;

            return String(a.primaryReservation?.guest?.name || "").localeCompare(
              String(b.primaryReservation?.guest?.name || ""),
              "pt-BR"
            );
          });

        return {
          stayKey: stayGroup.stayKey,
          stayName: stayGroup.stayName,
          reservationCount: presentationGroups.reduce((total, group) => total + group.items.length, 0),
          presentationGroups,
        };
      })
      .sort((a, b) => {
        const roomA =
          roomMetaById[a.presentationGroups[0]?.primaryReservation?.roomId] ||
          a.presentationGroups[0]?.primaryReservation?.room ||
          {};
        const roomB =
          roomMetaById[b.presentationGroups[0]?.primaryReservation?.roomId] ||
          b.presentationGroups[0]?.primaryReservation?.room ||
          {};
        return compareRoomsInMapOrder(roomA, roomB);
      });
  }, [weeklyPresentationReservations, roomMetaById]);

  const weeklyPresentationSummary = useMemo(() => {
    const groups = groupedWeeklyPresentations.flatMap((stayGroup) => stayGroup.presentationGroups);
    const total = groups.length;
    const pending = groups.filter((group) => group.pendingItems.length > 0).length;
    const completed = total - pending;

    return {
      total,
      pending,
      completed,
      reservations: weeklyPresentationReservations.length,
    };
  }, [groupedWeeklyPresentations, weeklyPresentationReservations]);

  const effectiveShowOnlyPending = showOnlyPending && weeklyPresentationSummary.pending > 0;

  const visiblePresentationGroups = useMemo(() => {
    if (!effectiveShowOnlyPending) return groupedWeeklyPresentations;
    return groupedWeeklyPresentations
      .map((stayGroup) => ({
        ...stayGroup,
        presentationGroups: stayGroup.presentationGroups.filter(
          (presentationGroup) => presentationGroup.pendingItems.length > 0
        ),
      }))
      .filter((stayGroup) => stayGroup.presentationGroups.length > 0);
  }, [groupedWeeklyPresentations, effectiveShowOnlyPending]);

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

  const updatePresentationStatus = async (items, newStatus, submitKey) => {
    if (!items.length) return;

    setSubmittingId(submitKey);
    try {
      const results = await Promise.allSettled(
        items.map((reservation) =>
          api(`/reservations/${reservation.id}`, {
            method: "PUT",
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );

      const updatedById = new Map();

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          updatedById.set(result.value.id, result.value);
          return;
        }

        console.error("Erro ao atualizar reserva:", items[index]?.id, result.reason);
      });

      if (updatedById.size > 0) {
        setReservations((prev) =>
          prev.map((item) => (updatedById.has(item.id) ? updatedById.get(item.id) : item))
        );
      }

      if (updatedById.size !== items.length) {
        alert("Erro ao atualizar uma ou mais reservas desta apresentacao.");
      }
    } catch (err) {
      console.error("Erro ao atualizar apresentacao:", err);
      alert("Erro ao atualizar o status da apresentacao.");
    } finally {
      setSubmittingId(null);
    }
  };

  const toggleSentCardDetails = (groupKey) => {
    setExpandedSentCards((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const renderPresentationCard = (presentationGroup, { compact = false } = {}) => {
    const reservation = presentationGroup.primaryReservation;
    const genderValue =
      settings.genderOverrides[getGenderKey(reservation)] || inferGender(reservation.guest?.name);
    const hasPending = presentationGroup.pendingItems.length > 0;
    const isExpanded = Boolean(expandedSentCards[presentationGroup.groupKey]);
    const isSubmitting = submittingId === presentationGroup.groupKey;
    const accommodationLabel =
      presentationGroup.roomCount === 1
        ? "1 acomodacao"
        : `${presentationGroup.roomCount} acomodacoes`;
    const reservationLabel =
      presentationGroup.items.length === 1
        ? "1 reserva"
        : `${presentationGroup.items.length} reservas`;

    if (compact) {
      return (
        <article
          key={presentationGroup.groupKey}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {reservation.guest?.name || "Hospede sem nome"}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {presentationGroup.items.length > 1
                  ? `Acomodacoes: ${presentationGroup.roomNames}`
                  : presentationGroup.roomNames}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {presentationGroup.dateSummary}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {reservationLabel}
              </div>
              <StatusBadge status={hasPending ? "registrada" : "agendada"} compact />
              <button
                type="button"
                onClick={() => toggleSentCardDetails(presentationGroup.groupKey)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {isExpanded ? "Ocultar mensagens" : "Ver mensagens"}
              </button>
            </div>
          </div>

          {isExpanded ? (
            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {getPresentationMessages(presentationGroup.items, settings).map((text, index) => (
                <MessageBlock
                  key={`${presentationGroup.groupKey}-presentation-compact-${index}`}
                  text={text}
                  label={`Mensagem ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </article>
      );
    }

    return (
      <article
        key={presentationGroup.groupKey}
        className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm dark:border-rose-900/60 dark:bg-slate-900/80"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {reservation.guest?.name || "Hospede sem nome"}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {presentationGroup.items.length > 1
                ? `Acomodacoes: ${presentationGroup.roomNames}`
                : presentationGroup.roomNames}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {presentationGroup.dateSummary}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {accommodationLabel}
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {reservationLabel}
            </div>
            <StatusBadge status={hasPending ? "registrada" : "agendada"} />
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
              onClick={() =>
                updatePresentationStatus(
                  presentationGroup.pendingItems,
                  "agendada",
                  presentationGroup.groupKey
                )
              }
              disabled={!hasPending || isSubmitting}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                hasPending
                  ? "bg-sky-700 hover:bg-sky-800"
                  : "cursor-not-allowed bg-slate-500 hover:bg-slate-500"
              }`}
            >
              {isSubmitting
                ? "Salvando..."
                : hasPending
                ? presentationGroup.pendingItems.length > 1
                  ? "Confirmar enviadas"
                  : "Confirmar enviada"
                : "Apresentacao enviada"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {getPresentationMessages(presentationGroup.items, settings).map((text, index) => (
            <MessageBlock
              key={`${presentationGroup.groupKey}-presentation-${index}`}
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
            value={normalizedStartDate}
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyPending(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  effectiveShowOnlyPending
                    ? "bg-rose-700 text-white hover:bg-rose-800"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                Somente pendentes
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyPending(false)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  !effectiveShowOnlyPending
                    ? "bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                Mostrar todas
              </button>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {effectiveShowOnlyPending
                  ? "Visualizacao focada em pendentes."
                  : "Visualizacao completa (pendentes + enviadas)."}
              </span>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Apresentacoes da semana
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Janela de {formatFullDate(normalizedStartDate)} ate {formatFullDate(presentationEndDate)}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {weeklyPresentationSummary.reservations} reserva(s) agrupada(s) em{" "}
              {weeklyPresentationSummary.total} apresentacao(oes).
            </p>
          </div>

          {weeklyPresentationReservations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nenhuma reserva com check-in dentro desta janela (segunda + 8 dias).
            </div>
          ) : visiblePresentationGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300">
              Nao ha apresentacoes pendentes para o filtro atual.
            </div>
          ) : (
            <div className="space-y-6">
              {visiblePresentationGroups.map((stayGroup) => (
                <div key={stayGroup.stayKey} className="space-y-4">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {stayGroup.stayName}
                  </div>

                  {(() => {
                    const pendingGroups = stayGroup.presentationGroups.filter(
                      (presentationGroup) => presentationGroup.pendingItems.length > 0
                    );
                    const sentGroups = stayGroup.presentationGroups.filter(
                      (presentationGroup) => presentationGroup.pendingItems.length === 0
                    );

                    return (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {stayGroup.reservationCount} reserva(s) na janela, agrupada(s) em{" "}
                            {stayGroup.presentationGroups.length} apresentacao(oes).
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                            {stayGroup.presentationGroups.length} grupo(s)
                          </div>
                        </div>

                        <div className="mt-4 space-y-5">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                              <span>Pendentes</span>
                              <span>{pendingGroups.length}</span>
                            </div>

                            {pendingGroups.length > 0 ? (
                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {pendingGroups.map((presentationGroup) =>
                                  renderPresentationCard(presentationGroup)
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Nenhuma apresentacao pendente para este empreendimento.
                              </div>
                            )}
                          </div>

                          {!effectiveShowOnlyPending ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                <span>Enviadas</span>
                                <span>{sentGroups.length}</span>
                              </div>

                              {sentGroups.length > 0 ? (
                                <div className="space-y-3">
                                  {sentGroups.map((presentationGroup) =>
                                    renderPresentationCard(presentationGroup, { compact: true })
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                  Nenhuma apresentacao enviada para este empreendimento.
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";
import {
  compareRoomsInMapOrder,
  formatDate,
  formatFullDate,
  getGenderKey,
  inferGender,
} from "./guestPresentationShared";
import {
  buildGuestCheckoutAlert,
  getDailyGuestCheckoutSummary,
  getGuestCheckoutMessage,
  getGuestCheckoutStayKey,
  getGuestCheckoutStaySettings,
  getStoredGuestCheckoutSettings,
  isPendingGuestCheckoutReservation,
  makeGuestCheckoutDeliveryKey,
  saveGuestCheckoutSettings,
} from "./guestCheckoutShared";

dayjs.extend(utc);

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
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
      ? "Concluída"
      : normalized === "cancelada"
      ? "Cancelada"
      : status;

  return (
    <span
      className={`inline-flex min-w-[112px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${classes}`}
    >
      {label}
    </span>
  );
}

function MessageBlock({ text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Mensagem pronta
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
        className="min-h-[240px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </div>
  );
}

export default function GuestCheckouts() {
  const api = useApi();
  const today = dayjs().format("YYYY-MM-DD");

  const [checkoutDate, setCheckoutDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(() => getStoredGuestCheckoutSettings());
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reservationsRes, roomsRes] = await Promise.all([api("/reservations"), api("/rooms")]);
        setReservations(reservationsRes || []);
        setRooms(roomsRes || []);
      } catch (err) {
        console.error("Erro ao carregar check-outs hóspedes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const roomMetaById = useMemo(
    () =>
      rooms.reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms]
  );

  const checkoutReservations = useMemo(() => {
    return [...reservations]
      .filter(
        (reservation) =>
          reservation.status !== "cancelada" &&
          reservation.checkoutDate &&
          sameDay(reservation.checkoutDate, checkoutDate)
      )
      .sort((a, b) => {
        const roomA = roomMetaById[a.roomId] || a.room || {};
        const roomB = roomMetaById[b.roomId] || b.room || {};
        const roomCompare = compareRoomsInMapOrder(roomA, roomB);

        if (roomCompare !== 0) return roomCompare;
        return String(a.guest?.name || "").localeCompare(String(b.guest?.name || ""), "pt-BR");
      });
  }, [checkoutDate, reservations, roomMetaById]);

  const stayGroups = useMemo(() => {
    const grouped = new Map();

    [...rooms].sort(compareRoomsInMapOrder).forEach((room) => {
      const stayName = room.stay?.name || "Sem empreendimento";
      const stayKey = getGuestCheckoutStayKey(room.stay || stayName);

      if (!grouped.has(stayKey)) {
        grouped.set(stayKey, {
          stayKey,
          stayId: room.stay?.id || null,
          stayName,
          stayPosition: room.stay?.position ?? 9999,
        });
      }
    });

    return [...grouped.values()].sort((a, b) => {
      const positionDiff = a.stayPosition - b.stayPosition;
      if (positionDiff !== 0) return positionDiff;
      return a.stayName.localeCompare(b.stayName, "pt-BR");
    });
  }, [rooms]);

  const checkoutSummary = useMemo(
    () => getDailyGuestCheckoutSummary(reservations, checkoutDate, settings),
    [reservations, checkoutDate, settings]
  );

  const alertState = useMemo(
    () =>
      buildGuestCheckoutAlert(
        checkoutSummary,
        checkoutDate === today ? "hoje" : formatFullDate(checkoutDate)
      ),
    [checkoutSummary, checkoutDate, today]
  );

  const effectiveShowOnlyPending = showOnlyPending && checkoutSummary.pending > 0;

  const visibleReservations = useMemo(() => {
    if (!effectiveShowOnlyPending) return checkoutReservations;
    return checkoutReservations.filter((reservation) =>
      isPendingGuestCheckoutReservation(reservation, settings)
    );
  }, [checkoutReservations, effectiveShowOnlyPending, settings]);

  const saveSettings = (updater) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveGuestCheckoutSettings(next);
      return next;
    });
  };

  const handleDefaultChange = (field, value) => {
    saveSettings((prev) => ({
      ...prev,
      defaults: {
        ...prev.defaults,
        [field]: value,
      },
    }));
  };

  const handleStaySettingChange = (stayKey, field, value) => {
    saveSettings((prev) => ({
      ...prev,
      stays: {
        ...prev.stays,
        [stayKey]: {
          ...(prev.stays[stayKey] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleGenderOverride = (reservation, value) => {
    const key = getGenderKey(reservation);
    saveSettings((prev) => ({
      ...prev,
      genderOverrides: {
        ...prev.genderOverrides,
        [key]: value,
      },
    }));
  };

  const handleDeliveryStatusChange = (reservation, isSent) => {
    const deliveryKey = makeGuestCheckoutDeliveryKey(reservation);
    saveSettings((prev) => ({
      ...prev,
      deliveryStatus: {
        ...prev.deliveryStatus,
        [deliveryKey]: isSent,
      },
    }));
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-outs hóspedes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Lembretes de saída do dia com confirmação local de mensagem enviada.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Data dos check-outs
          </div>
          <input
            type="date"
            value={checkoutDate}
            onChange={(e) => setCheckoutDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Enviadas
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {checkoutSummary.sent}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Pendentes
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
            {checkoutSummary.pending}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total do dia
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {checkoutSummary.total}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="mb-5 space-y-3">
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                alertState.isPending
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
              }`}
            >
              {alertState.message}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyPending(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  effectiveShowOnlyPending
                    ? "bg-amber-700 text-white hover:bg-amber-800"
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
                Mostrar todos
              </button>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {effectiveShowOnlyPending
                  ? "Visualização focada em mensagens pendentes."
                  : "Visualização completa (pendentes + enviadas)."}
              </span>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Reservas com check-out
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatFullDate(checkoutDate)} • {checkoutReservations.length} reserva(s) no dia.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Carregando check-outs...
            </div>
          ) : checkoutReservations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nenhuma reserva com check-out para esta data.
            </div>
          ) : visibleReservations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-10 text-center text-sm text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300">
              Não há mensagens pendentes para o filtro atual.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleReservations.map((reservation) => {
                const genderValue =
                  settings.genderOverrides[getGenderKey(reservation)] ||
                  inferGender(reservation.guest?.name);
                const isSent = !isPendingGuestCheckoutReservation(reservation, settings);
                const message = getGuestCheckoutMessage(reservation, settings);
                const staySettings = getGuestCheckoutStaySettings(settings, reservation);
                const missingFields = [];

                if (!staySettings.checkoutTime) missingFields.push("horário de check-out");
                if (!staySettings.formLink) missingFields.push("link do formulário");

                return (
                  <article
                    key={reservation.id}
                    className={`rounded-2xl border p-4 ${
                      isSent
                        ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {reservation.room?.stay?.name || "Sem empreendimento"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {reservation.guest?.name || "Hóspede sem nome"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {reservation.room?.title || "Sem acomodação"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          entra {formatDate(reservation.checkinDate)} e sai{" "}
                          {formatDate(reservation.checkoutDate)}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          Check-out configurado até {staySettings.checkoutTime || "não definido"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                            isSent
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {isSent ? "Mensagem enviada" : "Pendente de envio"}
                        </div>
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
                          onClick={() => handleDeliveryStatusChange(reservation, !isSent)}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                            isSent
                              ? "bg-slate-600 hover:bg-slate-700"
                              : "bg-emerald-700 hover:bg-emerald-800"
                          }`}
                        >
                          {isSent ? "Marcar pendente" : "Confirmar enviada"}
                        </button>
                      </div>
                    </div>

                    {missingFields.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        Preencha {missingFields.join(" e ")} nas configurações locais para completar a
                        mensagem.
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <MessageBlock text={message} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Variáveis locais
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Os campos abaixo ficam salvos apenas neste navegador, no mesmo estilo da tela de
              check-ins.
            </p>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Padrão geral
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <input
                    value={settings.defaults.checkoutTime || ""}
                    onChange={(e) => handleDefaultChange("checkoutTime", e.target.value)}
                    placeholder="Horário padrão de check-out"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    value={settings.defaults.formLink || ""}
                    onChange={(e) => handleDefaultChange("formLink", e.target.value)}
                    placeholder="Link padrão do formulário"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {stayGroups.map((stayGroup) => {
                  const rawStaySettings = settings.stays[stayGroup.stayKey] || {};

                  return (
                    <div
                      key={stayGroup.stayKey}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {stayGroup.stayName}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <input
                          value={rawStaySettings.checkoutTime || ""}
                          onChange={(e) =>
                            handleStaySettingChange(
                              stayGroup.stayKey,
                              "checkoutTime",
                              e.target.value
                            )
                          }
                          placeholder={`Horário de check-out (padrão: ${settings.defaults.checkoutTime || "-"})`}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <input
                          value={rawStaySettings.formLink || ""}
                          onChange={(e) =>
                            handleStaySettingChange(stayGroup.stayKey, "formLink", e.target.value)
                          }
                          placeholder="Link do formulário (opcionalmente específico por empreendimento)"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}

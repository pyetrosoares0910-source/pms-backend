import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useApi } from "../lib/api";
import { compareRoomsInMapOrder, formatFullDate } from "./guestPresentationShared";

dayjs.extend(utc);

const ALERT_DAYS = 10;
const STORAGE_KEY = "cleaning-integrity-verifications";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseDay(value) {
  if (!value) return null;
  const parsed = dayjs.utc(value).startOf("day");
  return parsed.isValid() ? parsed : null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pluralDays(days) {
  if (days === null || days === undefined) return "sem histórico";
  return `${days} ${Number(days) === 1 ? "dia" : "dias"}`;
}

function getStoredVerifications() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredVerifications(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function isCanceled(reservation) {
  return String(reservation?.status || "").toLowerCase() === "cancelada";
}

function getRoomId(room) {
  return room?.id || room?.roomId || "";
}

function getRoomLabel(room) {
  return room?.title || room?.name || "Sem acomodação";
}

function getStayLabel(room) {
  return room?.stay?.name || "Sem empreendimento";
}

function buildRoomIntegrity({ room, reservations, verificationDate, today }) {
  const roomReservations = reservations.filter(
    (reservation) => !isCanceled(reservation) && reservation.roomId === room.id
  );

  const activeReservation =
    roomReservations.find((reservation) => {
      const checkin = parseDay(reservation.checkinDate);
      const checkout = parseDay(reservation.checkoutDate);
      return checkin && checkout && !checkin.isAfter(today, "day") && checkout.isAfter(today, "day");
    }) || null;

  const lastCheckout =
    roomReservations
      .map((reservation) => ({
        reservation,
        checkout: parseDay(reservation.checkoutDate),
      }))
      .filter((item) => item.checkout && !item.checkout.isAfter(today, "day"))
      .sort((a, b) => b.checkout.valueOf() - a.checkout.valueOf())[0] || null;

  const nextReservation =
    roomReservations
      .map((reservation) => ({
        reservation,
        checkin: parseDay(reservation.checkinDate),
      }))
      .filter((item) => item.checkin && item.checkin.isAfter(today, "day"))
      .sort((a, b) => a.checkin.valueOf() - b.checkin.valueOf())[0] || null;

  const verifiedAt = parseDay(verificationDate);
  const referenceCandidates = [lastCheckout?.checkout, verifiedAt].filter(Boolean);
  const referenceDate =
    referenceCandidates.length > 0
      ? referenceCandidates.sort((a, b) => b.valueOf() - a.valueOf())[0]
      : null;

  const isOccupied = Boolean(activeReservation);
  const daysVacant = isOccupied || !referenceDate ? null : Math.max(0, today.diff(referenceDate, "day"));
  const isAlert = !isOccupied && daysVacant !== null && daysVacant > ALERT_DAYS;
  const referenceKind =
    verifiedAt && (!lastCheckout?.checkout || verifiedAt.isAfter(lastCheckout.checkout, "day"))
      ? "verification"
      : lastCheckout?.checkout
        ? "checkout"
        : "none";

  return {
    room,
    roomId: getRoomId(room),
    stayName: getStayLabel(room),
    roomName: getRoomLabel(room),
    activeReservation: activeReservation,
    lastCheckoutReservation: lastCheckout?.reservation || null,
    lastCheckoutDate: lastCheckout?.checkout || null,
    nextReservation: nextReservation?.reservation || null,
    nextCheckinDate: nextReservation?.checkin || null,
    referenceDate,
    referenceKind,
    verifiedAt,
    daysVacant,
    isOccupied,
    isAlert,
  };
}

function StatCard({ label, value, tone = "slate" }) {
  const toneClasses = {
    slate: "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    red: "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    sky: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
  };

  return (
    <div className={cx("rounded-2xl border px-4 py-3 shadow-sm", toneClasses[tone])}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function IntegrityBadge({ item }) {
  if (item.isOccupied) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
        <Clock3 className="h-3.5 w-3.5" />
        Ocupada
      </span>
    );
  }

  if (item.isAlert) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-800 dark:bg-red-900/50 dark:text-red-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        Alerta
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Em dia
    </span>
  );
}

export default function CleaningIntegrity() {
  const api = useApi();
  const today = useMemo(() => dayjs().startOf("day"), []);
  const todayKey = today.format("YYYY-MM-DD");

  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [verifications, setVerifications] = useState(() => getStoredVerifications());
  const [filter, setFilter] = useState("alerts");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roomsRes, reservationsRes] = await Promise.all([api("/rooms"), api("/reservations")]);
      setRooms(Array.isArray(roomsRes) ? roomsRes : []);
      setReservations(Array.isArray(reservationsRes) ? reservationsRes : []);
    } catch (err) {
      console.error("Erro ao carregar integridade da limpeza:", err);
      setError("Não foi possível carregar acomodações e reservas agora.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const integrityItems = useMemo(() => {
    return [...rooms]
      .filter((room) => room.active !== false)
      .sort(compareRoomsInMapOrder)
      .map((room) =>
        buildRoomIntegrity({
          room,
          reservations,
          verificationDate: verifications[room.id]?.verifiedAt,
          today,
        })
      );
  }, [rooms, reservations, today, verifications]);

  const stats = useMemo(() => {
    const alerts = integrityItems.filter((item) => item.isAlert).length;
    const occupied = integrityItems.filter((item) => item.isOccupied).length;
    const verifiedToday = integrityItems.filter((item) =>
      item.verifiedAt ? item.verifiedAt.isSame(today, "day") : false
    ).length;
    const tracked = integrityItems.filter((item) => item.daysVacant !== null).length;

    return {
      total: integrityItems.length,
      alerts,
      occupied,
      verifiedToday,
      tracked,
    };
  }, [integrityItems, today]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(search);

    return integrityItems.filter((item) => {
      if (filter === "alerts" && !item.isAlert) return false;
      if (filter === "ok" && (item.isAlert || item.isOccupied)) return false;
      if (filter === "occupied" && !item.isOccupied) return false;

      if (!query) return true;

      const text = normalizeText(
        [
          item.roomName,
          item.stayName,
          item.lastCheckoutReservation?.guest?.name,
          item.nextReservation?.guest?.name,
        ].join(" ")
      );

      return text.includes(query);
    });
  }, [filter, integrityItems, search]);

  const handleVerifyRoom = (roomId) => {
    setVerifications((prev) => {
      const next = {
        ...prev,
        [roomId]: {
          verifiedAt: todayKey,
          updatedAt: new Date().toISOString(),
        },
      };
      saveStoredVerifications(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integridade da Limpeza</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Acompanha acomodações desocupadas e alerta quando passaram de {ALERT_DAYS} dias
            desde o último check-out ou desde a última verificação manual.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Acomodações" value={stats.total} />
        <StatCard label="Alertas" value={stats.alerts} tone="red" />
        <StatCard label="Monitoradas" value={stats.tracked} tone="emerald" />
        <StatCard label="Ocupadas hoje" value={stats.occupied} tone="sky" />
        <StatCard label="Verificadas hoje" value={stats.verifiedToday} />
      </section>

      <section
        className={cx(
          "rounded-2xl border px-4 py-3 text-sm font-semibold",
          stats.alerts > 0
            ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
            : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
        )}
      >
        {stats.alerts > 0
          ? `${stats.alerts} acomodação(ões) passaram de ${ALERT_DAYS} dias sem ocupação ou verificação.`
          : `Tudo certo: nenhuma acomodação ultrapassou ${ALERT_DAYS} dias sem ocupação ou verificação.`}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar acomodação, empreendimento ou hóspede"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["alerts", "Alertas"],
              ["all", "Todas"],
              ["ok", "Em dia"],
              ["occupied", "Ocupadas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  filter === value
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-2xl border border-slate-200 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Carregando integridade das acomodações...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nenhuma acomodação encontrada para o filtro atual.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <article
                key={item.roomId}
                className={cx(
                  "rounded-2xl border p-4 shadow-sm",
                  item.isAlert
                    ? "border-red-300 bg-red-50/95 dark:border-red-900/70 dark:bg-red-950/30"
                    : item.isOccupied
                      ? "border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20"
                      : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/35"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {item.stayName}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                      {item.roomName}
                    </div>
                  </div>
                  <IntegrityBadge item={item} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/60">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Sem ocupação
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {item.isOccupied ? "0 dias" : pluralDays(item.daysVacant)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/60">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Último check-out
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.lastCheckoutDate ? formatFullDate(item.lastCheckoutDate) : "Sem histórico"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/60">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Última verificação
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.verifiedAt ? formatFullDate(item.verifiedAt) : "Não informada"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {item.isOccupied ? (
                    <p>
                      Ocupada por {item.activeReservation?.guest?.name || "hóspede sem nome"} até{" "}
                      {formatFullDate(item.activeReservation?.checkoutDate)}.
                    </p>
                  ) : item.referenceKind === "verification" ? (
                    <p>Contagem reiniciada pela verificação manual mais recente.</p>
                  ) : item.referenceKind === "checkout" ? (
                    <p>Contagem baseada no último check-out registrado.</p>
                  ) : (
                    <p>Sem check-out anterior; informe uma verificação para iniciar o controle.</p>
                  )}

                  {item.nextCheckinDate ? (
                    <p>
                      Próximo check-in em {formatFullDate(item.nextCheckinDate)} para{" "}
                      {item.nextReservation?.guest?.name || "hóspede sem nome"}.
                    </p>
                  ) : (
                    <p>Sem próxima ocupação agendada.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleVerifyRoom(item.roomId)}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm",
                      item.isAlert
                        ? "bg-red-700 hover:bg-red-800"
                        : "bg-emerald-700 hover:bg-emerald-800"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Informar verificação
                  </button>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    A contagem passará a considerar {formatFullDate(todayKey)}.
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

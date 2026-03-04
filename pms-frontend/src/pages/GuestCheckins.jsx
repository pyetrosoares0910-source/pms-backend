import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";

dayjs.extend(utc);

const SETTINGS_KEY = "guest-checkins-settings-v1";

const defaultSettings = {
  hostName: "Pyetro",
  stayAccess: {},
  genderOverrides: {},
};

const femaleNames = new Set([
  "ana",
  "amanda",
  "beatriz",
  "bianca",
  "bruna",
  "camila",
  "carla",
  "carolina",
  "cintia",
  "clara",
  "daniela",
  "eduarda",
  "fabiana",
  "fernanda",
  "flavia",
  "gabriela",
  "giovanna",
  "isabela",
  "isabella",
  "jessica",
  "julia",
  "juliana",
  "larissa",
  "leticia",
  "luana",
  "luciana",
  "marcela",
  "maria",
  "mariana",
  "patricia",
  "paula",
  "priscila",
  "raissa",
  "renata",
  "sabrina",
  "tatiana",
  "vanessa",
  "vitoria",
  "yasmin",
]);

const maleNames = new Set([
  "andre",
  "antonio",
  "augusto",
  "bruno",
  "caio",
  "carlos",
  "daniel",
  "diego",
  "eduardo",
  "felipe",
  "fernando",
  "gabriel",
  "gustavo",
  "henrique",
  "igor",
  "joao",
  "jorge",
  "jose",
  "leonardo",
  "lucas",
  "luiz",
  "marcos",
  "mateus",
  "murilo",
  "pedro",
  "rafael",
  "ricardo",
  "rodrigo",
  "thiago",
  "vinicius",
  "vitor",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      hostName: parsed.hostName || defaultSettings.hostName,
      stayAccess: parsed.stayAccess || {},
      genderOverrides: parsed.genderOverrides || {},
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function formatDate(value) {
  return dayjs.utc(value).format("DD/MM");
}

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
}

function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function getGenderKey(reservation) {
  return reservation.guest?.id || reservation.guestId || reservation.id;
}

function inferGender(name) {
  const firstName = normalizeText(name).split(/\s+/)[0];
  if (!firstName) return "feminine";
  if (femaleNames.has(firstName)) return "feminine";
  if (maleNames.has(firstName)) return "masculine";
  if (firstName.endsWith("a")) return "feminine";
  return "masculine";
}

function getPresentationMessage(reservation, settings) {
  const stayName = reservation.room?.stay?.name || "seu empreendimento";
  const roomName = reservation.room?.title || "sua acomodacao";
  const guestName = reservation.guest?.name || "hospede";
  const gender =
    settings.genderOverrides[getGenderKey(reservation)] ||
    inferGender(guestName);

  const welcome = gender === "feminine" ? "bem-vinda" : "bem-vindo";
  const pronoun = gender === "feminine" ? "la" : "lo";
  const greeting = getGreeting();
  const hostName = settings.hostName || defaultSettings.hostName;

  return [
    `Ola, ${greeting}!`,
    "",
    `*Seja ${welcome} ao ${stayName}* 🌎`,
    `Sua reserva no studio *${roomName}* esta confirmada, com check-in no dia ${formatDate(
      reservation.checkinDate
    )} e check-out no dia ${formatDate(reservation.checkoutDate)}.`,
    "",
    `Meu nome e ${hostName}, e estarei a disposicao para ajuda-${pronoun} durante sua estadia.`,
    "No dia do check-in, enviarei as informacoes de acesso e as instrucoes necessarias para entrar no studio.",
    "",
    "Se tiver qualquer duvida ou precisar de algo, nao hesite em me procurar.",
    "Ate breve!",
  ].join("\n");
}

function sortReservations(items) {
  return [...items].sort((a, b) => {
    const stayCompare = String(a.room?.stay?.name || "").localeCompare(
      String(b.room?.stay?.name || ""),
      "pt-BR"
    );
    if (stayCompare !== 0) return stayCompare;

    const roomCompare = String(a.room?.title || "").localeCompare(
      String(b.room?.title || ""),
      "pt-BR"
    );
    if (roomCompare !== 0) return roomCompare;

    return String(a.guest?.name || "").localeCompare(
      String(b.guest?.name || ""),
      "pt-BR"
    );
  });
}

function StatusBadge({ status }) {
  const classes =
    status === "ativa"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "concluida"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${classes}`}>
      {status}
    </span>
  );
}

export default function GuestCheckins() {
  const api = useApi();
  const [baseDate, setBaseDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [settings, setSettings] = useState(() => getStoredSettings());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const reservationsRes = await api("/reservations");
        setReservations(reservationsRes || []);
      } catch (err) {
        console.error("Erro ao carregar check-ins:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const dayReservations = useMemo(() => {
    const filtered = reservations.filter(
      (reservation) =>
        reservation.status !== "cancelada" &&
        reservation.checkinDate &&
        sameDay(reservation.checkinDate, baseDate)
    );

    return sortReservations(filtered);
  }, [baseDate, reservations]);

  const stayList = useMemo(() => {
    const unique = new Set();
    reservations.forEach((reservation) => {
      const stayName = reservation.room?.stay?.name;
      if (stayName) unique.add(stayName);
    });
    return [...unique].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [reservations]);

  const handleSettingChange = (field, value) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      saveSettings(next);
      return next;
    });
  };

  const handleStayAccessChange = (stayName, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        stayAccess: {
          ...prev.stayAccess,
          [stayName]: {
            ...(prev.stayAccess[stayName] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
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
      saveSettings(next);
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

      setReservations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
      alert("Erro ao atualizar reserva.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check-ins de hospedes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mensagens de apresentacao para reservas com check-in na data selecionada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setBaseDate(dayjs(baseDate).subtract(1, "day").format("YYYY-MM-DD"))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Dia anterior
          </button>
          <input
            type="date"
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={() => setBaseDate(dayjs(baseDate).add(1, "day").format("YYYY-MM-DD"))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Proximo dia
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-3">
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
        <div className="lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Observacao
          </div>
          <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
            Genero e dados de acesso ficam salvos apenas neste navegador.
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando check-ins...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr,0.7fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Apresentacoes do dia
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dayjs(baseDate).format("DD/MM/YYYY")} • {dayReservations.length} check-in(s)
                </p>
              </div>
            </div>

            {dayReservations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Nenhuma reserva com check-in para esta data.
              </div>
            ) : (
              <div className="space-y-4">
                {dayReservations.map((reservation) => {
                  const genderValue =
                    settings.genderOverrides[getGenderKey(reservation)] ||
                    inferGender(reservation.guest?.name);
                  const message = getPresentationMessage(reservation, settings);
                  const isActive = reservation.status === "ativa";

                  return (
                    <article
                      key={reservation.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            {reservation.room?.stay?.name || "Sem empreendimento"}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {reservation.guest?.name || "Hospede sem nome"}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {reservation.room?.title || "Sem acomodacao"} • {formatDate(
                              reservation.checkinDate
                            )} a {formatDate(reservation.checkoutDate)}
                          </div>
                        </div>

                        <StatusBadge status={reservation.status} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
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
                            updateReservationStatus(
                              reservation,
                              isActive ? "agendada" : "ativa"
                            )
                          }
                          disabled={submittingId === reservation.id}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                            isActive
                              ? "bg-sky-700 hover:bg-sky-800"
                              : "bg-cyan-600 hover:bg-cyan-700"
                          }`}
                        >
                          {submittingId === reservation.id
                            ? "Salvando..."
                            : isActive
                            ? "Reverter check-in"
                            : "Fazer check-in"}
                        </button>

                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(message)}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
                        >
                          Copiar mensagem
                        </button>
                      </div>

                      <textarea
                        readOnly
                        value={message}
                        className="mt-4 min-h-[260px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Acessos por empreendimento
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Configuracoes locais para a segunda etapa das mensagens.
              </p>

              {stayList.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Nenhum empreendimento encontrado.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {stayList.map((stayName) => {
                    const access = settings.stayAccess[stayName] || {};

                    return (
                      <div
                        key={stayName}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                      >
                        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {stayName}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <input
                            value={access.door1 || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "door1", e.target.value)
                            }
                            placeholder="1a porta"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={access.door2 || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "door2", e.target.value)
                            }
                            placeholder="2a porta"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={access.rest || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "rest", e.target.value)
                            }
                            placeholder="Restante"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Instrucoes de acesso
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Estrutura pronta. Falta apenas encaixar os modelos de mensagem que voce vai enviar na proxima etapa.
              </p>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}

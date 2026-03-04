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

dayjs.extend(utc);

const SETTINGS_KEY = "guest-checkins-instructions-v1";

const DEFAULT_TEMPLATE = `*{{WELCOME}} ao {{STAY_NAME}}*🌎
*{{ROOM_NAME}}*
Check-in 16:00 - Check-out 10:00
Endereço: {{APARTMENT_ADDRESS}}

• Ao chegar ao endereço, dirija-se à porta de entrada. Para abrir digite o código: #*{{DOOR1}}

• Prossiga para a próxima porta, passe a palma da mão sob o visor da fechadura e insira o código: *{{DOOR2}}.

• Direcione-se ao apartamento {{ROOM_NAME}} e repita o processo inserindo o código: {{UNIT_DOOR}}✓.

*Ao sair do apartamento, lembre-se de encostar a mão no visor da fechadura para acionar seu fechamento*

• *Rede Wi-Fi:*
{{WIFI_NAME}}
{{WIFI_PASSWORD}}

Tenha uma ótima estadia!`;

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        genderOverrides: {},
        stayData: {},
        roomData: {},
      };
    }
    const parsed = JSON.parse(raw);
    return {
      genderOverrides: parsed.genderOverrides || {},
      stayData: parsed.stayData || {},
      roomData: parsed.roomData || {},
    };
  } catch {
    return {
      genderOverrides: {},
      stayData: {},
      roomData: {},
    };
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
}

function roomKeyOf(input) {
  const room = input?.room || input;
  return (
    room?.id ||
    `${room?.stay?.name || "sem-stay"}|${room?.title || input?.id || "sem-room"}`
  );
}

function getStayName(reservation) {
  return reservation.room?.stay?.name || "Sem empreendimento";
}

function getRoomSettings(settings, room) {
  return settings.roomData[roomKeyOf(room)] || {};
}

function getStaySettings(settings, stayName) {
  return settings.stayData[stayName] || {};
}

function buildTemplateData(reservation, settings) {
  const stayName = getStayName(reservation);
  const staySettings = getStaySettings(settings, stayName);
  const roomSettings = getRoomSettings(settings, reservation);

  const gender =
    settings.genderOverrides[getGenderKey(reservation)] ||
    inferGender(reservation.guest?.name);

  const welcome = gender === "feminine" ? "Bem-vinda" : "Bem-vindo";

  return {
    GUEST_NAME: reservation.guest?.name || "Hóspede",
    STAY_NAME: stayName,
    ROOM_NAME: reservation.room?.title || "Acomodação",
    CHECKIN_DATE: formatDate(reservation.checkinDate),
    CHECKOUT_DATE: formatDate(reservation.checkoutDate),
    WELCOME: welcome,
    APARTMENT_ADDRESS: staySettings.apartmentAddress || "",
    PICKUP_ADDRESS: staySettings.pickupAddress || "",
    KEYSAFE_CODE: staySettings.keySafeCode || "",
    DOOR1: staySettings.door1 || "",
    DOOR2: roomSettings.door2 || "",
    UNIT_DOOR: roomSettings.unitDoor || "",
    WIFI_NAME: roomSettings.wifiName || "",
    WIFI_PASSWORD: roomSettings.wifiPassword || "",
  };
}

function applyTemplate(template, data) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => String(data[key] ?? ""));
}

function getGeneratedMessages(reservation, settings) {
  const roomSettings = getRoomSettings(settings, reservation);
  const templates =
    Array.isArray(roomSettings.templates) && roomSettings.templates.length > 0
      ? roomSettings.templates
      : [DEFAULT_TEMPLATE];

  const data = buildTemplateData(reservation, settings);
  return templates.map((template) => applyTemplate(template, data));
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
        className="min-h-[200px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </div>
  );
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
  const today = dayjs().format("YYYY-MM-DD");

  const [accessDate, setAccessDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(() => getStoredSettings());
  const [expandedStay, setExpandedStay] = useState({});
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reservationsRes, roomsRes] = await Promise.all([api("/reservations"), api("/rooms")]);
        setReservations(reservationsRes || []);
        setRooms(roomsRes || []);
      } catch (err) {
        console.error("Erro ao carregar check-ins:", err);
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

  const accessReservations = useMemo(() => {
    return [...reservations]
      .filter(
        (reservation) =>
          reservation.status !== "cancelada" &&
          reservation.checkinDate &&
          sameDay(reservation.checkinDate, accessDate)
      )
      .sort((a, b) => {
        const roomA = roomMetaById[a.roomId] || a.room || {};
        const roomB = roomMetaById[b.roomId] || b.room || {};

        const roomCompare = compareRoomsInMapOrder(roomA, roomB);
        if (roomCompare !== 0) return roomCompare;

        return String(a.guest?.name || "").localeCompare(String(b.guest?.name || ""), "pt-BR");
      });
  }, [accessDate, reservations, roomMetaById]);

  const staysWithRooms = useMemo(() => {
    const grouped = new Map();

    [...rooms].sort(compareRoomsInMapOrder).forEach((room) => {
      const stayName = room.stay?.name || "Sem empreendimento";
      if (!grouped.has(stayName)) {
        grouped.set(stayName, {
          stayName,
          stayPosition: room.stay?.position ?? 9999,
          rooms: [],
        });
      }
      grouped.get(stayName).rooms.push(room);
    });

    return [...grouped.values()].sort((a, b) => {
      const posDiff = a.stayPosition - b.stayPosition;
      if (posDiff !== 0) return posDiff;
      return a.stayName.localeCompare(b.stayName, "pt-BR");
    });
  }, [rooms]);

  const updateSettings = (updater) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next);
      return next;
    });
  };

  const handleGenderOverride = (reservation, value) => {
    const key = getGenderKey(reservation);
    updateSettings((prev) => ({
      ...prev,
      genderOverrides: {
        ...prev.genderOverrides,
        [key]: value,
      },
    }));
  };

  const handleStayFieldChange = (stayName, field, value) => {
    updateSettings((prev) => ({
      ...prev,
      stayData: {
        ...prev.stayData,
        [stayName]: {
          ...(prev.stayData[stayName] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleRoomFieldChange = (room, field, value) => {
    const roomKey = roomKeyOf(room);
    updateSettings((prev) => ({
      ...prev,
      roomData: {
        ...prev.roomData,
        [roomKey]: {
          ...(prev.roomData[roomKey] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleTemplateChange = (room, index, value) => {
    const roomKey = roomKeyOf(room);
    const current = getRoomSettings(settings, room);
    const templates = [...(current.templates || [DEFAULT_TEMPLATE])];
    templates[index] = value;

    updateSettings((prev) => ({
      ...prev,
      roomData: {
        ...prev.roomData,
        [roomKey]: {
          ...(prev.roomData[roomKey] || {}),
          templates,
        },
      },
    }));
  };

  const addTemplate = (room) => {
    const roomKey = roomKeyOf(room);
    const current = getRoomSettings(settings, room);
    const templates = [...(current.templates || [DEFAULT_TEMPLATE]), DEFAULT_TEMPLATE];

    updateSettings((prev) => ({
      ...prev,
      roomData: {
        ...prev.roomData,
        [roomKey]: {
          ...(prev.roomData[roomKey] || {}),
          templates,
        },
      },
    }));
  };

  const removeTemplate = (room, index) => {
    const roomKey = roomKeyOf(room);
    const current = getRoomSettings(settings, room);
    const templates = [...(current.templates || [DEFAULT_TEMPLATE])].filter(
      (_template, i) => i !== index
    );

    updateSettings((prev) => ({
      ...prev,
      roomData: {
        ...prev.roomData,
        [roomKey]: {
          ...(prev.roomData[roomKey] || {}),
          templates: templates.length > 0 ? templates : [DEFAULT_TEMPLATE],
        },
      },
    }));
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
      alert("Erro ao atualizar reserva.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instrucoes de acesso - hóspedes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Data atual por padrão, check-ins do dia e geração manual das mensagens.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Data dos acessos
          </div>
          <input
            type="date"
            value={accessDate}
            onChange={(e) => setAccessDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300 lg:col-span-2">
          {formatFullDate(accessDate)} - {accessReservations.length} check-in(s) no dia.
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando check-ins...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Reservas do dia
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Cards em vermelho antes do check-in e azul após check-in.
              </p>
            </div>

            {accessReservations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Nenhuma reserva com check-in para esta data.
              </div>
            ) : (
              <div className="space-y-4">
                {accessReservations.map((reservation) => {
                  const isActive = reservation.status === "ativa";
                  const genderValue =
                    settings.genderOverrides[getGenderKey(reservation)] ||
                    inferGender(reservation.guest?.name);
                  const messages = generated ? getGeneratedMessages(reservation, settings) : [];

                  return (
                    <article
                      key={reservation.id}
                      className={`rounded-2xl border p-4 ${
                        isActive
                          ? "border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30"
                          : "border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {getStayName(reservation)}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {reservation.guest?.name || "Hospede sem nome"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {reservation.room?.title || "Sem acomodacao"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            entra {formatDate(reservation.checkinDate)} e sai {formatDate(reservation.checkoutDate)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
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
                        </div>
                      </div>

                      {generated && (
                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {messages.map((text, index) => (
                            <MessageBlock
                              key={`${reservation.id}-generated-${index}`}
                              text={text}
                              label={`Modelo ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Dados por empreendimento e unidade
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Endereco e 1a porta no empreendimento. 2a porta, unidade, Wi-Fi e modelos por acomodacao.
              </p>

              <div className="mt-4 space-y-4">
                {staysWithRooms.map((stayGroup) => {
                  const stayName = stayGroup.stayName;
                  const stay = getStaySettings(settings, stayName);
                  const isOpen = expandedStay[stayName] ?? false;

                  return (
                    <div
                      key={stayName}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStay((prev) => ({
                            ...prev,
                            [stayName]: !isOpen,
                          }))
                        }
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {stayName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {isOpen ? "Fechar" : "Abrir"}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-1 gap-3">
                            <input
                              value={stay.apartmentAddress || ""}
                              onChange={(e) =>
                                handleStayFieldChange(stayName, "apartmentAddress", e.target.value)
                              }
                              placeholder="Endereco do apartamento (valido para todas as unidades)"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={stay.door1 || ""}
                              onChange={(e) =>
                                handleStayFieldChange(stayName, "door1", e.target.value)
                              }
                              placeholder="Codigo da 1a porta (valido para todas as unidades)"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={stay.pickupAddress || ""}
                              onChange={(e) =>
                                handleStayFieldChange(stayName, "pickupAddress", e.target.value)
                              }
                              placeholder="Endereco de retirada das chaves (opcional)"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={stay.keySafeCode || ""}
                              onChange={(e) =>
                                handleStayFieldChange(stayName, "keySafeCode", e.target.value)
                              }
                              placeholder="Senha do cofre (opcional)"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>

                          <div className="space-y-3 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Unidades
                            </div>

                            {stayGroup.rooms.map((room) => {
                              const roomSettings = getRoomSettings(settings, room);
                              const templates =
                                Array.isArray(roomSettings.templates) && roomSettings.templates.length > 0
                                  ? roomSettings.templates
                                  : [DEFAULT_TEMPLATE];

                              return (
                                <div
                                  key={roomKeyOf(room)}
                                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {room.title}
                                  </div>

                                  <div className="grid grid-cols-1 gap-2">
                                    <input
                                      value={roomSettings.door2 || ""}
                                      onChange={(e) =>
                                        handleRoomFieldChange(room, "door2", e.target.value)
                                      }
                                      placeholder="Codigo da 2a porta"
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <input
                                      value={roomSettings.unitDoor || ""}
                                      onChange={(e) =>
                                        handleRoomFieldChange(room, "unitDoor", e.target.value)
                                      }
                                      placeholder="Codigo da porta da unidade"
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <input
                                      value={roomSettings.wifiName || ""}
                                      onChange={(e) =>
                                        handleRoomFieldChange(room, "wifiName", e.target.value)
                                      }
                                      placeholder="Nome Wi-Fi"
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <input
                                      value={roomSettings.wifiPassword || ""}
                                      onChange={(e) =>
                                        handleRoomFieldChange(room, "wifiPassword", e.target.value)
                                      }
                                      placeholder="Senha Wi-Fi"
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    />
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Modelos de mensagem
                                    </div>

                                    {templates.map((template, index) => (
                                      <div key={`${roomKeyOf(room)}-template-${index}`} className="space-y-2">
                                        <textarea
                                          value={template}
                                          onChange={(e) =>
                                            handleTemplateChange(room, index, e.target.value)
                                          }
                                          className="min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                        />
                                        <div className="flex justify-end">
                                          <button
                                            type="button"
                                            onClick={() => removeTemplate(room, index)}
                                            disabled={templates.length === 1}
                                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50 dark:border-slate-700"
                                          >
                                            Remover modelo
                                          </button>
                                        </div>
                                      </div>
                                    ))}

                                    <button
                                      type="button"
                                      onClick={() => addTemplate(room)}
                                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] dark:border-slate-700"
                                    >
                                      Adicionar modelo
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={() => setGenerated(true)}
              className="w-full rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white hover:bg-sky-800"
            >
              Gerar check-ins
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

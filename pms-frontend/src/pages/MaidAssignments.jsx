import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";

dayjs.extend(utc);

const SETTINGS_KEY = "maid-assignments-settings-v1";
const defaultSettings = {
  defaults: {
    checkoutTime: "10h",
    checkinTime: "16h",
  },
  stays: {},
  tasks: {},
};

const stayAliasRules = [
  { match: ["itaim"], alias: "Tabapuã" },
  { match: ["jk"], alias: "Clodomiro" },
  { match: ["iguatemi"], alias: "Butantã" },
  { match: ["internacional"], alias: "Urussuí" },
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
}

function getStayAlias(name) {
  const normalized = normalizeText(name);
  const rule = stayAliasRules.find(({ match }) =>
    match.some((token) => normalized.includes(token))
  );
  if (rule) return rule.alias;
  return String(name || "Sem stay").split("(")[0].trim();
}

function formatApartmentLabel(roomTitle) {
  const match = String(roomTitle || "").match(/(\d+)/);
  if (!match) return roomTitle || "-";
  return `Apto ${Number(match[1])}`;
}

function makeTaskStorageKey(task) {
  return [
    task.date,
    task.maidId || task.maid || "sem-diarista",
    task.stay,
    task.rooms,
  ].join("|");
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return {
      defaults: {
        ...defaultSettings.defaults,
        ...(JSON.parse(raw).defaults || {}),
      },
      stays: JSON.parse(raw).stays || {},
      tasks: JSON.parse(raw).tasks || {},
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function buildTaskDetails(tasks, rooms, reservations, settings) {
  const roomsByStayAndTitle = new Map();
  const roomsByTitle = new Map();

  rooms.forEach((room) => {
    const titleKey = normalizeText(room.title);
    const stayKey = normalizeText(room.stay?.name);
    roomsByStayAndTitle.set(`${stayKey}|${titleKey}`, room);
    if (!roomsByTitle.has(titleKey)) {
      roomsByTitle.set(titleKey, []);
    }
    roomsByTitle.get(titleKey).push(room);
  });

  return tasks.map((task) => {
    const roomTitleKey = normalizeText(task.rooms);
    const stayKey = normalizeText(task.stay);

    const room =
      roomsByStayAndTitle.get(`${stayKey}|${roomTitleKey}`) ||
      roomsByTitle.get(roomTitleKey)?.[0] ||
      null;

    const checkoutReservation = reservations.find(
      (reservation) =>
        reservation.status !== "cancelada" &&
        room?.id &&
        reservation.roomId === room.id &&
        sameDay(reservation.checkoutDate, task.date)
    );

    const nextCheckin = reservations.find(
      (reservation) =>
        reservation.status !== "cancelada" &&
        room?.id &&
        reservation.roomId === room.id &&
        sameDay(reservation.checkinDate, task.date)
    );

    const taskStorageKey = makeTaskStorageKey(task);
    const persistedTaskData = settings.tasks[taskStorageKey] || {};
    const stayAlias = getStayAlias(task.stay);

    return {
      ...task,
      roomId: room?.id || null,
      roomTitle: room?.title || task.rooms,
      apartmentLabel: formatApartmentLabel(room?.title || task.rooms),
      stayAlias,
      reservationNotes: checkoutReservation?.notes?.trim() || "",
      hasNextCheckin: Boolean(nextCheckin),
      taskStorageKey,
      checkoutTime:
        persistedTaskData.checkoutTime || settings.defaults.checkoutTime,
      checkinTime:
        persistedTaskData.checkinTime || settings.defaults.checkinTime,
      extraInfo: persistedTaskData.extraInfo || "",
    };
  });
}

function groupByMaid(tasks) {
  const grouped = {};

  tasks.forEach((task) => {
    const maidName = task.maid || "Sem diarista";
    if (!grouped[maidName]) {
      grouped[maidName] = [];
    }
    grouped[maidName].push(task);
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([maidName, items]) => ({
      maidName,
      items: items.sort((a, b) => {
        const stayCompare = a.stayAlias.localeCompare(b.stayAlias, "pt-BR");
        if (stayCompare !== 0) return stayCompare;
        return a.apartmentLabel.localeCompare(b.apartmentLabel, "pt-BR");
      }),
    }));
}

function buildGeneratedText(maidName, tasks, settings, date) {
  const stayGroups = {};

  tasks.forEach((task) => {
    if (!stayGroups[task.stayAlias]) {
      stayGroups[task.stayAlias] = [];
    }
    stayGroups[task.stayAlias].push(task);
  });

  const lines = [`Limpeza ${dayjs(date).format("DD/MM")}`, ""];

  Object.entries(stayGroups).forEach(([stayAlias, stayTasks]) => {
    lines.push(stayAlias);

    stayTasks.forEach((task) => {
      const detailParts = [`${task.apartmentLabel} - sai ${task.checkoutTime}`];

      if (task.hasNextCheckin) {
        detailParts.push(`entra ${task.checkinTime}`);
      }

      const notes = [task.reservationNotes, task.extraInfo]
        .filter(Boolean)
        .join(" | ");

      lines.push(notes ? `${detailParts.join(" ")} (${notes})` : detailParts.join(" "));
    });

    lines.push("");
  });

  lines.push("Senhas");

  Object.keys(stayGroups).forEach((stayAlias) => {
    const staySettings = settings.stays[stayAlias] || {};
    lines.push(`* ${stayAlias}`);
    lines.push(`1ª porta: #*${staySettings.door1 || ""}`);
    lines.push(`2ª porta: ${staySettings.door2 || ""}`);
    lines.push(`Restante: ${staySettings.rest || ""}`);
    lines.push("");
  });

  return { maidName, text: lines.join("\n").trim() };
}

function DetailSection({
  title,
  dateLabel,
  groups,
  onTaskSettingsChange,
  editable,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{dateLabel}</p>
        </div>
        <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {groups.length} diaristas
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nenhuma diarista encontrada para este período.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article
              key={group.maidName}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {group.maidName}
              </h3>

              <div className="space-y-3">
                {group.items.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          {task.stayAlias}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {task.apartmentLabel}
                        </div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {task.roomTitle}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          sai {task.checkoutTime}
                        </span>
                        {task.hasNextCheckin && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            entra {task.checkinTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {(task.reservationNotes || task.extraInfo) && (
                      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                        {[task.reservationNotes, task.extraInfo]
                          .filter(Boolean)
                          .join(" | ")}
                      </div>
                    )}

                    {editable && (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <input
                          value={task.checkoutTime}
                          onChange={(e) =>
                            onTaskSettingsChange(task.taskStorageKey, "checkoutTime", e.target.value)
                          }
                          placeholder="Saída"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <input
                          value={task.checkinTime}
                          onChange={(e) =>
                            onTaskSettingsChange(task.taskStorageKey, "checkinTime", e.target.value)
                          }
                          placeholder="Entrada"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <input
                          value={task.extraInfo}
                          onChange={(e) =>
                            onTaskSettingsChange(task.taskStorageKey, "extraInfo", e.target.value)
                          }
                          placeholder="Observação complementar"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MaidAssignments() {
  const api = useApi();
  const [baseDate, setBaseDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(true);
  const [showGeneratedLists, setShowGeneratedLists] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [settings, setSettings] = useState(() => getStoredSettings());

  const nextDate = useMemo(
    () => dayjs(baseDate).add(1, "day").format("YYYY-MM-DD"),
    [baseDate]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tasksRes, roomsRes, reservationsRes] = await Promise.all([
          api(`/tasks/checkouts?start=${baseDate}&end=${nextDate}`),
          api("/rooms"),
          api("/reservations"),
        ]);

        setTasks(tasksRes || []);
        setRooms(roomsRes || []);
        setReservations(reservationsRes || []);
      } catch (err) {
        console.error("Erro ao carregar listagem de diaristas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api, baseDate, nextDate]);

  const detailedTasks = useMemo(
    () => buildTaskDetails(tasks, rooms, reservations, settings),
    [tasks, rooms, reservations, settings]
  );

  const activeTodayGroups = useMemo(
    () => groupByMaid(detailedTasks.filter((task) => task.date === baseDate && task.maid)),
    [baseDate, detailedTasks]
  );

  const tomorrowGroups = useMemo(
    () => groupByMaid(detailedTasks.filter((task) => task.date === nextDate && task.maid)),
    [detailedTasks, nextDate]
  );

  const tomorrowStays = useMemo(() => {
    const aliases = new Set();
    tomorrowGroups.forEach((group) =>
      group.items.forEach((item) => aliases.add(item.stayAlias))
    );
    return [...aliases].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tomorrowGroups]);

  const generatedLists = useMemo(
    () =>
      tomorrowGroups.map((group) =>
        buildGeneratedText(group.maidName, group.items, settings, nextDate)
      ),
    [nextDate, settings, tomorrowGroups]
  );

  const handleTaskSettingsChange = (taskKey, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskKey]: {
            ...(prev.tasks[taskKey] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
      return next;
    });
  };

  const handleDefaultChange = (field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        defaults: {
          ...prev.defaults,
          [field]: value,
        },
      };
      saveSettings(next);
      return next;
    });
  };

  const handleStaySettingChange = (stayAlias, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        stays: {
          ...prev.stays,
          [stayAlias]: {
            ...(prev.stays[stayAlias] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listagem diaristas</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visão detalhada das diaristas ativas hoje e confirmadas para amanhã.
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
            Próximo dia
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Padrão saída
          </div>
          <input
            value={settings.defaults.checkoutTime}
            onChange={(e) => handleDefaultChange("checkoutTime", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Padrão entrada
          </div>
          <input
            value={settings.defaults.checkinTime}
            onChange={(e) => handleDefaultChange("checkinTime", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Geração
          </div>
          <button
            type="button"
            onClick={() => setShowGeneratedLists(true)}
            className="mt-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Gerar listas
          </button>
        </div>
      </section>

      {tomorrowStays.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Senhas por empreendimento
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tomorrowStays.map((stayAlias) => {
              const staySettings = settings.stays[stayAlias] || {};
              return (
                <div
                  key={stayAlias}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {stayAlias}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        1ª porta (sem #*)
                      </label>
                      <input
                        value={staySettings.door1 || ""}
                        onChange={(e) =>
                          handleStaySettingChange(stayAlias, "door1", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        2ª porta
                      </label>
                      <input
                        value={staySettings.door2 || ""}
                        onChange={(e) =>
                          handleStaySettingChange(stayAlias, "door2", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Restante
                      </label>
                      <input
                        value={staySettings.rest || ""}
                        onChange={(e) =>
                          handleStaySettingChange(stayAlias, "rest", e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando listagem...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DetailSection
            title="Ativas hoje"
            dateLabel={dayjs(baseDate).format("DD/MM/YYYY")}
            groups={activeTodayGroups}
            onTaskSettingsChange={handleTaskSettingsChange}
            editable={false}
          />

          <DetailSection
            title="Confirmadas para amanhã"
            dateLabel={dayjs(nextDate).format("DD/MM/YYYY")}
            groups={tomorrowGroups}
            onTaskSettingsChange={handleTaskSettingsChange}
            editable
          />
        </div>
      )}

      {showGeneratedLists && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Listas geradas para amanhã
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {dayjs(nextDate).format("DD/MM/YYYY")}
              </p>
            </div>
          </div>

          {generatedLists.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nenhuma lista disponível para amanhã.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {generatedLists.map((list) => (
                <div
                  key={list.maidName}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {list.maidName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(list.text)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] dark:border-slate-700"
                    >
                      Copiar
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={list.text}
                    className="min-h-[320px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

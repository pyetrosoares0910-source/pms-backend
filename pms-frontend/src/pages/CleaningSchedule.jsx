import { useState, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useApi } from "../lib/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import CleaningDateModal from "../components/CleaningDateModal";

// ativar plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const CleaningSchedule = () => {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCleaningTask, setSelectedCleaningTask] = useState(null);

  // novos estados para filtro
  const [startDate, setStartDate] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(
    dayjs().endOf("month").format("YYYY-MM-DD")
  );

  const fetchData = async () => {
    const checkouts = await api(
      `/tasks/checkouts?start=${startDate}&end=${endDate}`
    );
    const maidsRes = await api("/maids");

    const mapped = checkouts.map((t) => ({
      id: t.id,
      date: dayjs(t.date).format("YYYY-MM-DD"),
      stay: t.stay || "Sem Stay",
      rooms: t.rooms || "Sem identificação",
      maid: t.maid || null,
      maidId: t.maidId || null,
      reservation: t.reservation || null,
    }));

    setTasks(mapped);
    setMaids(maidsRes);
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]); // dispara quando as datas mudam

  // Gera a lista de dias entre startDate e endDate (inclusive)
  const days = [];
  if (startDate && endDate) {
    let cursor = dayjs(startDate);
    const end = dayjs(endDate);

    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      days.push(cursor);
      cursor = cursor.add(1, "day");
    }
  }

  // estatísticas semanais
  const maidStats = maids.map((m) => {
    const uniqueDays = new Set(
      tasks.filter((t) => t.maid === m.name).map((t) => t.date)
    );

    const byWeek = [0, 0, 0, 0];
    [...uniqueDays].forEach((d) => {
      const day = dayjs.utc(d).date();
      if (day <= 7) byWeek[0]++;
      else if (day <= 14) byWeek[1]++;
      else if (day <= 21) byWeek[2]++;
      else byWeek[3]++;
    });

    return {
      name: m.name,
      total: uniqueDays.size,
      byWeek,
    };
  });

  const sortedMaidStats = [...maidStats].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR")
  );

  // agenda: agrupar eventos por diarista + data
  const groupedEvents = {};
  tasks.forEach((t) => {
    const key = `${t.date}-${t.maid || "Sem diarista"}`;
    if (!groupedEvents[key]) {
      groupedEvents[key] = {
        id: key,
        title: t.maid || "Sem diarista",
        start: t.date,
        allDay: true,
        details: [],
      };
    }
    groupedEvents[key].details.push(`${t.stay} - ${t.rooms}`);
  });

  // paleta adaptada para dark mode (classes completas)
  const colorPalette = [
    "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-200 dark:border-emerald-800/60",
    "bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/45 dark:text-sky-200 dark:border-sky-800/60",
    "bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/45 dark:text-indigo-200 dark:border-indigo-800/60",
    "bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 dark:bg-fuchsia-950/45 dark:text-fuchsia-200 dark:border-fuchsia-800/60",
    "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/45 dark:text-amber-200 dark:border-amber-800/60",
  ];

  const getColorClass = (name) => {
    if (!name) return colorPalette[0];
    const idx =
      Math.abs(
        [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % colorPalette.length;
    return colorPalette[idx];
  };

  const events = Object.values(groupedEvents);

  return (
    <div className="p-6 space-y-10 min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <h1 className="text-4xl font-extrabold mb-8 tracking-tight text-slate-900 dark:text-slate-50">
        Controle de Limpeza
      </h1>

      {/* Filtro de Datas */}
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Início
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input input-bordered bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input input-bordered bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          />
        </div>
        <button
          onClick={fetchData}
          className="btn btn-primary bg-sky-700 border-sky-700 hover:bg-sky-800 hover:border-sky-800 dark:bg-sky-600 dark:border-sky-600 dark:hover:bg-sky-500 dark:hover:border-sky-500"
        >
          Aplicar
        </button>
      </div>

      {/* Tabelas por dia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {days.map((d) => {
          const dayTasks = tasks.filter(
            (t) => t.date === d.format("YYYY-MM-DD")
          );
          return (
            <div
              key={d.toString()}
              className="rounded-2xl shadow-md overflow-hidden border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-sky-700 to-sky-600 dark:from-sky-800 dark:to-sky-900 text-white px-4 py-3 text-lg font-semibold tracking-wide">
                {d.format("DD/MM dddd")}
              </div>
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                      Local
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                      Acomodações
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                      Diarista
                    </th>
                    <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                      Acao
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayTasks.length > 0 ? (
                    [...dayTasks]
                      .sort((a, b) => {
                        if (a.stay < b.stay) return -1;
                        if (a.stay > b.stay) return 1;
                        if (a.rooms < b.rooms) return -1;
                        if (a.rooms > b.rooms) return 1;
                        return 0;
                      })
                      .map((t, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                        >
                          <td className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                            {t.stay}
                          </td>
                          <td className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                            {t.rooms}
                          </td>
                          <td className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                            <select
                              value={t.maidId || ""}
                              onChange={async (e) => {
                                const maidId = e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null;

                                await api(`/tasks/${t.id}/assign`, {
                                  method: "PUT",
                                  body: JSON.stringify({ maidId }),
                                });

                                setTasks((prev) =>
                                  prev.map((task) =>
                                    task.id === t.id
                                      ? {
                                        ...task,
                                        maid:
                                          maids.find(
                                            (m) => m.id === maidId
                                          )?.name || null,
                                        maidId,
                                      }
                                      : task
                                  )
                                );
                              }}
                              className="select select-sm w-full border-gray-300 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                            >
                              <option value="">-- Selecionar --</option>
                              {maids
                                .filter((m) =>
                                  m.available?.includes(d.format("ddd"))
                                )
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setSelectedCleaningTask(t)}
                              disabled={!t.reservation}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Alterar dia de limpeza
                            </button>
                            {t.reservation?.cleaningDateOverride ? (
                              <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                                Motivo: {t.reservation.cleaningChangeReason || "Nao informado"}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-5 text-center text-gray-400 dark:text-slate-500"
                      >
                        Nenhuma tarefa para este dia
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Estatísticas semanais */}
      <div className="rounded-2xl shadow-md border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 dark:from-purple-800 dark:to-purple-900 text-white px-4 py-3 text-lg font-semibold tracking-wide rounded-t-2xl">
          Controle Semanal de Diaristas
        </div>
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                Diarista
              </th>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                1ª sem
              </th>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                2ª sem
              </th>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                3ª sem
              </th>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700">
                4ª sem
              </th>
              <th className="px-4 py-3 border border-gray-200 dark:border-slate-700 font-bold">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMaidStats.map((m, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 font-medium">
                  {m.name}
                </td>
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 text-center">
                  {m.byWeek[0]}
                </td>
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 text-center">
                  {m.byWeek[1]}
                </td>
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 text-center">
                  {m.byWeek[2]}
                </td>
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 text-center">
                  {m.byWeek[3]}
                </td>
                <td className="px-4 py-3 border border-gray-200 dark:border-slate-700 font-bold text-center">
                  {m.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Agenda */}
      <div className="app-card overflow-hidden p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
              Calendario
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">
              Agenda de Limpeza
            </h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Escalas e pendencias
          </span>
        </div>
        <div className="app-calendar rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="pt-br"
            events={events}
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek,dayGridDay",
            }}
            dayHeaderClassNames="text-xs text-gray-500 dark:text-slate-400 tracking-wide"
            eventContent={(arg) => {
              if (arg.event.title === "Sem diarista") {
                return (
                  <div
                    className="bg-orange-50 text-orange-800 border border-orange-200 px-2 py-1 rounded-lg shadow-sm text-xs font-semibold cursor-pointer dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800/60"
                    onClick={() => setSelectedEvent(arg.event)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedEvent(arg.event);
                    }}
                  >
                    {arg.event.title}
                  </div>
                );
              }

              const colorClasses = getColorClass(arg.event.title);
              return (
                <div
                  className={`${colorClasses} px-2 py-1 rounded-lg shadow-sm text-xs font-semibold cursor-pointer`}
                  onClick={() => setSelectedEvent(arg.event)}
                >
                  {arg.event.title}
                </div>
              );
            }}

          />
        </div>
      </div>

      {/* Modal de detalhes */}
      {selectedEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              {selectedEvent.title}
            </h2>
            <ul className="space-y-2">
              {selectedEvent.extendedProps.details.map((d, idx) => (
                <li key={idx} className="text-gray-700 dark:text-slate-200">
                  🏨 {d}
                </li>
              ))}
            </ul>
            <div className="mt-6 text-right">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      <CleaningDateModal
        open={!!selectedCleaningTask}
        onClose={() => setSelectedCleaningTask(null)}
        reservation={selectedCleaningTask?.reservation}
        onUpdated={async () => {
          setSelectedCleaningTask(null);
          await fetchData();
        }}
      />
    </div>
  );
};

export default CleaningSchedule;

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useApi } from "../lib/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import CleaningDateModal from "../components/CleaningDateModal";
import {
  CalendarDays,
  ClipboardList,
  Hotel,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";

// ativar plugins
dayjs.extend(utc);
dayjs.extend(timezone);

function getCleaningStayGroup(stay) {
  const name = stay || "Sem Stay";
  return name.toLowerCase().includes("iguatemi") ? "Iguatemi Stay" : name;
}

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
      maidId: m.id,
      name: m.name,
      total: uniqueDays.size,
      byWeek,
    };
  });

  const sortedMaidStats = [...maidStats].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const nameCompare = a.name.localeCompare(b.name, "pt-BR");
    if (nameCompare !== 0) return nameCompare;
    return (Number(a.maidId) || 0) - (Number(b.maidId) || 0);
  });

  const assignedTasks = tasks.filter((t) => t.maidId || t.maid).length;
  const pendingTasks = Math.max(0, tasks.length - assignedTasks);

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
    <div className="min-h-screen space-y-6 p-4 text-slate-900 transition-colors duration-300 dark:text-slate-100 sm:p-6">
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-black/20 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200">
            <Sparkles size={14} />
            operação de limpeza
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Controle de Limpeza
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Escalas por checkout, diaristas e calendário operacional.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Tarefas
            </div>
            <div className="text-lg font-black text-slate-950 dark:text-slate-50">{tasks.length}</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Designadas
            </div>
            <div className="text-lg font-black text-slate-950 dark:text-slate-50">{assignedTasks}</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Pendentes
            </div>
            <div className="text-lg font-black text-slate-950 dark:text-slate-50">{pendingTasks}</div>
          </div>
        </div>
      </div>

      {/* Filtro de Datas */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mr-auto flex items-center gap-2 pb-2 text-sm font-bold text-slate-600 dark:text-slate-300">
          <CalendarDays size={18} />
          Período de exibição
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Início
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-700 dark:focus:ring-sky-950/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-700 dark:focus:ring-sky-950/50"
          />
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700"
        >
          <RefreshCw size={16} />
          Aplicar
        </button>
      </div>

      {/* Tabelas por dia */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {days.map((d) => {
          const dayTasks = tasks.filter(
            (t) => t.date === d.format("YYYY-MM-DD")
          );
          return (
            <div
              key={d.toString()}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-950 px-4 py-3 text-white dark:border-slate-800">
                <div className="flex items-center gap-2 text-base font-black tracking-tight">
                  <ClipboardList size={18} />
                  {d.format("DD/MM dddd")}
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                  {dayTasks.length} tarefas
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                        Nº
                      </th>
                      <th className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                        Acomodações
                      </th>
                      <th className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                        Diarista
                      </th>
                      <th className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayTasks.length > 0 ? (
                      [...dayTasks]
                        .sort((a, b) => {
                          const groupA = getCleaningStayGroup(a.stay);
                          const groupB = getCleaningStayGroup(b.stay);
                          if (groupA < groupB) return -1;
                          if (groupA > groupB) return 1;
                          if (a.rooms < b.rooms) return -1;
                          if (a.rooms > b.rooms) return 1;
                          return 0;
                        })
                        .flatMap((t, idx, sortedTasks) => {
                          const stayGroup = getCleaningStayGroup(t.stay);
                          const startsStayGroup =
                            idx === 0 || getCleaningStayGroup(sortedTasks[idx - 1].stay) !== stayGroup;
                          const stayTaskCount = startsStayGroup
                            ? sortedTasks.filter((item) => getCleaningStayGroup(item.stay) === stayGroup).length
                            : 0;
                          const stayTaskIndex = sortedTasks
                            .slice(0, idx + 1)
                            .filter((item) => getCleaningStayGroup(item.stay) === stayGroup).length;

                          return [
                            startsStayGroup ? (
                              <tr key={`stay-${d.format("YYYY-MM-DD")}-${t.stay}`}>
                                <td
                                  colSpan="4"
                                  className="border-y border-slate-200/80 bg-slate-100/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/80"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                                      <Hotel size={14} className="text-sky-500" />
                                      {stayGroup}
                                    </div>
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                      {stayTaskCount} tarefas
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ) : null,
                            <tr
                              key={t.id || `${t.date}-${t.stay}-${t.rooms}-${idx}`}
                              className="transition hover:bg-sky-50/40 dark:hover:bg-slate-900/70"
                            >
                              <td className="border-b border-slate-200/70 px-4 py-3 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                  {stayTaskIndex}
                                </span>
                              </td>
                              <td className="border-b border-slate-200/70 px-4 py-3 font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                {t.rooms}
                              </td>
                              <td className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
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
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-700 dark:focus:ring-sky-950/50"
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
                              <td className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCleaningTask(t)}
                                  disabled={!t.reservation}
                                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Alterar dia de limpeza
                                </button>
                                {t.reservation?.cleaningDateOverride ? (
                                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                                    Motivo: {t.reservation.cleaningChangeReason || "Não informado"}
                                  </div>
                                ) : null}
                              </td>
                            </tr>,
                          ].filter(Boolean);
                        })
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-8 text-center text-sm font-semibold text-slate-400 dark:text-slate-500"
                        >
                          Nenhuma tarefa para este dia
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Estatísticas semanais */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/20">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-950 px-4 py-3 text-white dark:border-slate-800">
          <div className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Users size={18} />
            Controle Semanal de Diaristas
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
            {sortedMaidStats.length} diaristas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center dark:border-slate-800">
                  Posição
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                  Diarista
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center dark:border-slate-800">
                  1ª sem
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center dark:border-slate-800">
                  2ª sem
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center dark:border-slate-800">
                  3ª sem
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center dark:border-slate-800">
                  4ª sem
                </th>
                <th className="border-b border-slate-200/80 px-4 py-3 text-center font-bold dark:border-slate-800">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMaidStats.map((m, idx) => (
                <tr
                  key={idx}
                  className="transition hover:bg-sky-50/40 dark:hover:bg-slate-900/70"
                >
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center dark:border-slate-800">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                    {m.name}
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center dark:border-slate-800">
                    {m.byWeek[0]}
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center dark:border-slate-800">
                    {m.byWeek[1]}
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center dark:border-slate-800">
                    {m.byWeek[2]}
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center dark:border-slate-800">
                    {m.byWeek[3]}
                  </td>
                  <td className="border-b border-slate-200/70 px-4 py-3 text-center font-black text-slate-950 dark:border-slate-800 dark:text-slate-50">
                    {m.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agenda */}
      <div className="app-card overflow-hidden p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
              Calendário
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">
              Agenda de Limpeza
            </h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Escalas e pendências
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
                    className="cursor-pointer rounded-lg border border-rose-300 bg-rose-600 px-2 py-1 text-xs font-black text-white shadow-sm shadow-rose-500/25 ring-1 ring-rose-100 transition hover:bg-rose-700 dark:border-rose-500/70 dark:bg-rose-600 dark:text-white dark:ring-rose-400/20 dark:hover:bg-rose-500"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-slate-50">
                <Hotel size={18} />
                {selectedEvent.title}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-2 p-5">
              {selectedEvent.extendedProps.details.map((d, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  🏨 {d}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-200/80 px-5 py-4 text-right dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700"
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

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useApi } from "../lib/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

// ativar plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const CleaningSchedule = () => {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // novos estados para filtro
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));


  const fetchData = async () => {
    const checkouts = await api(`/tasks/checkouts?start=${startDate}&end=${endDate}`);
    const maidsRes = await api("/maids");

    const mapped = checkouts.map((t) => ({
  id: t.id,
  date: dayjs(t.date).format("YYYY-MM-DD"),
  stay: t.stay || "Sem Stay",
  rooms: t.rooms || "Sem identificação",
  maid: t.maid || null,
  maidId: t.maidId || null,
}));


    setTasks(mapped);
    setMaids(maidsRes);
  };

  useEffect(() => {
  if (startDate && endDate) {
    fetchData();
  }
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

  const colorPalette = [
    { bg: "bg-green-100", text: "text-green-800", border: "border-green-400" },
    { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-400" },
    { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-400" },
    { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-400" },
    { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-400" },
  ];

  const getColorClass = (name) => {
    if (!name) return colorPalette[0];
    const idx = Math.abs(
      [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % colorPalette.length;
    return colorPalette[idx];
  };

  const events = Object.values(groupedEvents);

  return (
    <div className="p-6 space-y-10 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-8 tracking-tight">
        Controle de Limpeza
      </h1>

      {/* Filtro de Datas */}
      <div className="flex gap-4 items-end mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input input-bordered"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fim</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input input-bordered"
          />
        </div>
        <button
          onClick={fetchData}
          className="btn btn-primary bg-sky-700 border-sky-700"
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
              key={d}
              className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200"
            >
              <div className="bg-gradient-to-r from-sky-700 to-sky-600 text-white px-4 py-3 text-lg font-semibold tracking-wide">
                {d.format("DD/MM dddd")}
              </div>
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 border">Local</th>
                    <th className="px-4 py-3 border">Acomodações</th>
                    <th className="px-4 py-3 border">Diarista</th>
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
        <tr key={idx} className="hover:bg-gray-50 transition">
          <td className="px-4 py-3 border">{t.stay}</td>
          <td className="px-4 py-3 border">{t.rooms}</td>
          <td className="px-4 py-3 border">
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
                            maids.find((m) => m.id === maidId)?.name || null,
                          maidId,
                        }
                      : task
                  )
                );
              }}
              className="select select-sm w-full border-gray-300 rounded-lg"
            >
              <option value="">-- Selecionar --</option>
              {maids
                .filter((m) => m.available?.includes(d.format("ddd")))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </td>
        </tr>
      ))
  ) : (
    <tr>
      <td
        colSpan="3"
        className="px-4 py-5 text-center text-gray-400"
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
      <div className="bg-white rounded-2xl shadow-md border border-gray-200">
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 text-white px-4 py-3 text-lg font-semibold tracking-wide rounded-t-2xl">
          Controle Semanal de Diaristas
        </div>
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 border">Diarista</th>
              <th className="px-4 py-3 border">1ª sem</th>
              <th className="px-4 py-3 border">2ª sem</th>
              <th className="px-4 py-3 border">3ª sem</th>
              <th className="px-4 py-3 border">4ª sem</th>
              <th className="px-4 py-3 border font-bold">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {maidStats.map((m, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 border font-medium">{m.name}</td>
                <td className="px-4 py-3 border text-center">{m.byWeek[0]}</td>
                <td className="px-4 py-3 border text-center">{m.byWeek[1]}</td>
                <td className="px-4 py-3 border text-center">{m.byWeek[2]}</td>
                <td className="px-4 py-3 border text-center">{m.byWeek[3]}</td>
                <td className="px-4 py-3 border font-bold text-center">
                  {m.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Agenda */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200">
        <div className="bg-gradient-to-r from-green-700 to-green-500 text-white px-4 py-3 text-lg font-semibold tracking-wide rounded-t-2xl">
          Agenda de Limpeza
        </div>
        <div className="p-4">
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
            dayHeaderClassNames="text-xs text-gray-500 tracking-wide"
            eventContent={(arg) => {
              if (arg.event.title === "Sem diarista") {
                return (
                  <div className="bg-red-100 text-red-700 border border-red-300 px-2 py-1 rounded-lg shadow-sm text-xs font-medium cursor-default">
                    {arg.event.title}
                  </div>
                );
              }

              const color = getColorClass(arg.event.title);
              return (
                <div
                  className={`${color.bg} ${color.text} ${color.border} border px-2 py-1 rounded-lg shadow-sm text-xs font-medium cursor-pointer`}
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
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {selectedEvent.title}
            </h2>
            <ul className="space-y-2">
              {selectedEvent.extendedProps.details.map((d, idx) => (
                <li key={idx} className="text-gray-700">
                  🏨 {d}
                </li>
              ))}
            </ul>
            <div className="mt-6 text-right">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningSchedule;

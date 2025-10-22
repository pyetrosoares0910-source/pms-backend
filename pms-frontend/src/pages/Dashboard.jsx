import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dayjs from "dayjs";
import { useApi } from "../lib/api";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import minMax from "dayjs/plugin/minMax";
import utc from "dayjs/plugin/utc";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(minMax);
dayjs.extend(utc);

const today = dayjs.utc().startOf("day");
const ymd = (d) => dayjs(d).format("YYYY-MM-DD");

function overlapDays(a0, a1, b0, b1) {
  const start = dayjs.max(dayjs(a0), dayjs(b0));
  const end = dayjs.min(dayjs(a1), dayjs(b1));
  const diff = end.diff(start, "day");
  return Math.max(0, diff);
}

function monthBounds(d = new Date()) {
  const start = dayjs(d).startOf("month");
  const end = start.add(1, "month");
  return { start, end, daysInMonth: start.daysInMonth() };
}

function abbrevStay(name) {
  const map = {
    "Itaim Stay (Tabapuã)": "Itaim",
    "Itaim Stay 2 (Tabapuã)": "Itaim 2",
    "JK Stay (Clodomiro)": "JK",
    "Internacional Stay (Urussuí)": "Internacional",
    "Iguatemi Stay A (Butantã)": "Iguatemi A",
    "Iguatemi Stay B (Butantã)": "Iguatemi B",
    "Estanconfor Vila Olímpia": "Vila Olímpia",
  };
  if (map[name]) return map[name];
  return name.split("(")[0].trim();
}

export default function Dashboard() {
  const api = useApi();
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stays, setStays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

 
  // === Carrega dados ===
useEffect(() => {
  (async () => {
    try {
      const start = dayjs().startOf("week").format("YYYY-MM-DD");
      const end = dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD");

      const [rsv, rms, sts, checkouts, maidsRes, maint] = await Promise.all([
        api("/reservations"),
        api("/rooms"),
        api("/stays"),
        api(`/tasks/checkouts?start=${start}&end=${end}`),
        api("/maids"),
        api("/maintenance"),
      ]);


      const mappedTasks = (checkouts || []).map((t) => ({
        id: t.id,
        date: dayjs.utc(t.date || t.checkoutDate || new Date()).format("YYYY-MM-DD"),
        stay: t.stay || "Sem Stay",
        rooms: t.rooms || "Sem identificação",
        maid: t.maid || null,
        maidId: t.maidId || null,
      }));

      setReservations(rsv || []);
      setRooms(rms || []);
      setStays(sts || []);
      setTasks(mappedTasks);
      setMaids(maidsRes || []);
      setMaintenance(maint || []);
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    }
  })();
}, [api]);


  const today = dayjs().startOf("day");
  const { start: mStart, end: mEnd, daysInMonth } = monthBounds();

  // === Ocupação por empreendimento ===
  const occupancy = useMemo(() => {
    const roomsByStay = {};
    rooms.forEach((r) => {
      const stayId = r.stay?.id || "none";
      if (!roomsByStay[stayId])
        roomsByStay[stayId] = { stayId, stayName: r.stay?.name, rooms: [] };
      roomsByStay[stayId].rooms.push(r.id);
    });

    const occRows = Object.values(roomsByStay).map((group) => {
      const roomSet = new Set(group.rooms);
      let occupiedNights = 0;
      reservations
        .filter((r) => r.status !== "cancelada" && roomSet.has(r.roomId))
        .forEach((r) => {
          occupiedNights += overlapDays(
            r.checkinDate,
            r.checkoutDate,
            mStart,
            mEnd
          );
        });

      const capacity = group.rooms.length * daysInMonth;
      const pct =
        capacity > 0 ? Math.round((occupiedNights / capacity) * 100) : 0;

      return {
        stayId: group.stayId,
        name: group.stayName,
        label: abbrevStay(group.stayName),
        ocupacao: pct,
      };
    });

    const avg =
      occRows.length > 0
        ? Math.round(
            occRows.reduce((sum, r) => sum + r.ocupacao, 0) / occRows.length
          )
        : 0;

    return { rows: occRows, avg };
  }, [rooms, reservations, mStart, mEnd, daysInMonth]);

  // === KPIs principais ===
  const kpis = useMemo(() => {
  const activeToday = reservations.filter(
    (r) =>
      r.status !== "cancelada" &&
      dayjs.utc(r.checkinDate).isSameOrBefore(today) &&
      dayjs.utc(r.checkoutDate).isAfter(today)
  ).length;

  const checkinsToday = reservations.filter(
    (r) =>
      r.status !== "cancelada" &&
      dayjs.utc(r.checkinDate).isSame(today, "day")
  ).length;

  const checkoutsToday = reservations.filter(
    (r) =>
      r.status !== "cancelada" &&
      dayjs.utc(r.checkoutDate).isSame(today, "day")
  ).length;

  const nightsInMonth = reservations.reduce((sum, r) => {
    if (r.status === "cancelada") return sum;
    const ci = dayjs(r.checkinDate);
    const co = dayjs(r.checkoutDate);
    return sum + overlapDays(ci, co, mStart, mEnd);
  }, 0);

  const totalReservas = reservations.length;

  const reservasNoMes = reservations.filter((r) => {
  if (r.status === "cancelada") return false;
  const ci = dayjs(r.checkinDate);
  const co = dayjs(r.checkoutDate);
  return overlapDays(ci, co, mStart, mEnd) > 0;
}).length;

  const mediaDiariasReserva =
  reservasNoMes > 0 ? (nightsInMonth / reservasNoMes).toFixed(1) : "-";


  const maiorOcupacao =
    occupancy.rows?.length > 0
      ? occupancy.rows.reduce((a, b) =>
          a.ocupacao > b.ocupacao ? a : b
        )
      : null;

  const menorOcupacao =
    occupancy.rows?.length > 0
      ? occupancy.rows.reduce((a, b) =>
          a.ocupacao < b.ocupacao ? a : b
        )
      : null;

  const diariasLimpeza = tasks.length;

  const topEfficiency = (() => {
  const roomMap = {};

  // percorre todas as reservas válidas no mês
  reservations.forEach((r) => {
    if (r.status === "cancelada") return;
    const ci = dayjs(r.checkinDate);
    const co = dayjs(r.checkoutDate);

    const overlap = overlapDays(ci, co, mStart, mEnd);
    if (overlap <= 0) return;

    // acumula diárias ocupadas por quarto
    if (!roomMap[r.roomId]) {
      roomMap[r.roomId] = { roomId: r.roomId, noites: 0, capacidade: daysInMonth };
    }
    roomMap[r.roomId].noites += overlap;
  });

  // converte para lista com taxa de ocupação e nome do quarto
  const roomList = Object.values(roomMap).map((r) => {
    const room = rooms.find((rm) => rm.id === r.roomId);
    return {
      label: room?.title || `#${r.roomId}`,
      ocupacao: Math.min(100, Math.round((r.noites / r.capacidade) * 100)),
    };
  });

  // top 10 ordenado
  return roomList.sort((a, b) => b.ocupacao - a.ocupacao).slice(0, 10);
})();



  return {
    activeToday,
    checkinsToday,
    checkoutsToday,
    nightsInMonth,
    totalReservas,
    mediaDiariasReserva,
    maiorOcupacao,
    menorOcupacao,
    diariasLimpeza,
    topEfficiency,
  };
}, [reservations, today, mStart, mEnd, occupancy.rows, tasks]);



  // === Eventos (Limpeza) ===
  const cleaningEvents = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = `${t.date}-${t.maid || "Sem diarista"}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          title: t.maid || "Sem diarista",
          start: t.date,
          allDay: true,
          details: [],
        };
      }
      map[key].details.push(`${t.stay} – ${t.rooms}`);
    });
    return Object.values(map);
  }, [tasks]);

  // === Eventos (Manutenção) ===
  const maintenanceEvents = useMemo(
    () =>
      (maintenance || []).map((t) => ({
        id: t.id,
        title: `${t.title}${t.responsible ? " – " + t.responsible : ""}`,
        start: t.dueDate || t.createdAt,
        allDay: true,
      })),
    [maintenance]
  );

  // === Progresso de manutenção ===
  const maintenanceStats = useMemo(() => {
    const total = maintenance.length;
    const pend = maintenance.filter((t) => t.status === "pendente").length;
    const prog = maintenance.filter((t) => t.status === "andamento").length;
    const done = maintenance.filter((t) => t.status === "concluido").length;
    return {
      total,
      pend,
      prog,
      done,
      pctDone: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [maintenance]);

 // === Diaristas (Hoje e Amanhã) ===
const todayStr = dayjs().format("YYYY-MM-DD");
const tomorrowStr = dayjs().add(1, "day").format("YYYY-MM-DD");

const maidsToday = useMemo(() => {
  const acc = {};
  tasks.forEach((t) => {
    const taskDate = dayjs(t.date).format("YYYY-MM-DD");
    if (taskDate === todayStr && t.maid) {
      if (!acc[t.maid]) acc[t.maid] = [];
      acc[t.maid].push(`${t.stay} – ${t.rooms}`);
    }
  });
  return acc;
}, [tasks, todayStr]);

const maidsTomorrow = useMemo(() => {
  const acc = {};
  tasks.forEach((t) => {
    const taskDate = dayjs(t.date).format("YYYY-MM-DD");
    if (taskDate === tomorrowStr && t.maid) {
      if (!acc[t.maid]) acc[t.maid] = [];
      acc[t.maid].push(`${t.stay} – ${t.rooms}`);
    }
  });
  return acc;
}, [tasks, tomorrowStr]);

  // === RETORNO VISUAL ===
  return (
    <div className="p-6 space-y-8 bg-base-100 min-h-screen">
      <h1 className="text-3xl font-bold text-neutral">Dashboard</h1>

    



{/* ==== GRID PRINCIPAL (cards + eficiência + manutenção) ==== */}
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

  {/* === 8 CARDS === */}
  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 content-start">
    <StatCard title="Reservas ativas (hoje)" value={kpis.activeToday} icon="📖" color="primary" />
    <StatCard title="Check-ins (hoje)" value={kpis.checkinsToday} icon="🛎️" color="accent" />
    <StatCard title="Check-outs (hoje)" value={kpis.checkoutsToday} icon="🧳" color="info" />
    <StatCard title="Diárias no mês" value={kpis.nightsInMonth} icon="🗓️" color="secondary" />
    <StatCard title="Média de diárias por reserva" value={kpis.mediaDiariasReserva} icon="📆" color="info" />
    <StatCard title="Maior ocupação" value={kpis.maiorOcupacao ? kpis.maiorOcupacao.label : "-"} icon="🏆" color="success" />
    <StatCard title="Diárias de limpeza" value={kpis.diariasLimpeza} icon="🪣" color="secondary" />
    <StatCard title="Menor ocupação" value={kpis.menorOcupacao ? kpis.menorOcupacao.label : "-"} icon="⚠️" color="error" />
  </div>

  {/* === COLUNA DIREITA (Top 10 + Donut) === */}
  <div className="lg:col-span-2 flex flex-col gap-6">
    {/* TOP EFICIÊNCIA */}
    <div className="card bg-white shadow-md border border-gray-100 flex-1 flex flex-col">
      <div className="card-body p-6 flex flex-col justify-center">
        <h2 className="font-semibold text-neutral mb-4 text-center">
          📊 Top 10 Acomodações com Melhor Eficiência
        </h2>
        <div className="flex-grow flex items-center justify-center">
          <ResponsiveContainer width="95%" height={380}>
            <BarChart
              data={kpis.topEfficiency}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={120}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <RechartsTooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="ocupacao" fill="#3B82F6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* DONUT MANUTENÇÃO */}
    <div className="card bg-white shadow-md border border-gray-100 flex-1 flex flex-col items-center justify-center p-6">
      <h2 className="font-semibold text-neutral mb-4">🛠️ Progresso da Manutenção</h2>
      <PieChart width={160} height={160}>
        <Pie
          data={[
            { name: "Concluídas", value: maintenanceStats.done },
            { name: "Pendentes", value: maintenanceStats.total - maintenanceStats.done },
          ]}
          dataKey="value"
          innerRadius={55}
          outerRadius={75}
          paddingAngle={3}
          stroke="none"
        >
          <Cell fill="#22c55e" />
          <Cell fill="#e5e7eb" />
        </Pie>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={20}
          fontWeight="bold"
        >
          {maintenanceStats.pctDone}%
        </text>
      </PieChart>
      <p className="text-sm text-gray-500 mt-2">
        {maintenanceStats.done} concluídas de {maintenanceStats.total}
      </p>
    </div>
  </div>

</div>


      {/* ==== GRÁFICOS + DIARISTAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocupação */}
        <div className="card bg-white shadow-xl rounded-2xl border border-gray-100 lg:col-span-2">
          <div className="card-body px-6">
            <h2 className="card-title text-lg font-semibold text-neutral mb-4">
              📈 Ocupação por empreendimento{" "}
              <span className="text-sm text-gray-500">
                (média geral: {occupancy.avg}%)
              </span>
            </h2>
            <ResponsiveContainer width="100%" height={350}>
  <BarChart
    data={occupancy.rows}
    barSize={55} 
    margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
  >
    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
    <XAxis
      dataKey="label"
      tick={{ fill: "#6b7280", fontSize: 13 }}
      interval={0}
      tickMargin={10}
    />
    <YAxis
      domain={[0, 100]}
      type="number"
      allowDecimals={false}
      tickFormatter={(v) => `${v}%`}
      tick={{ fill: "#6b7280", fontSize: 12 }}
      padding={{ top: 0 }}
    />
    <RechartsTooltip
      formatter={(v) => `${v}%`}
      labelFormatter={(l, p) => p?.[0]?.payload?.name || l}
      contentStyle={{
        borderRadius: "8px",
        borderColor: "#e5e7eb",
      }}
    />
    <Bar
      dataKey="ocupacao"
      name="Ocupação (%)"
      fill="#3B82F6"
      radius={[6, 6, 0, 0]} // cantos suaves
      isAnimationActive={false}
    />
  </BarChart>
</ResponsiveContainer>



          </div>
        </div>

        {/* Diaristas */}
        <div className="card bg-white shadow-xl rounded-2xl border border-gray-100">
          <div className="card-body px-6">
            <h2 className="card-title text-lg font-semibold text-neutral mb-3">
              👥 Diaristas
            </h2>

            <DiaristaList
              title="Ativas hoje"
              data={maidsToday}
              color="blue"
              empty="Nenhuma diarista ativa hoje"
            />
            <hr className="my-3" />
            <DiaristaList
              title="Confirmadas para amanhã"
              data={maidsTomorrow}
              color="amber"
              empty="Nenhuma diarista confirmada amanhã"
            />
          </div>
        </div>
      </div>

      {/* ==== AGENDAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalendarCard
          title="🧹 Agenda de Limpeza"
          events={cleaningEvents}
          emptyText="Sem diaristas programadas"
        />
        <CalendarCard
          title="🛠️ Agenda de Atividades"
          events={maintenanceEvents}
          emptyText="Sem tarefas de manutenção"
        />
      </div>
    </div>
  );
}

/* ============================
   COMPONENTES AUXILIARES
============================ */

function StatCard({ title, value, icon, color = "primary" }) {
  return (
    <div className="card bg-white shadow-lg rounded-2xl border border-gray-100">
      <div className="card-body flex flex-col items-center justify-center text-center px-6 py-4">
        <div className="text-neutral mb-1 font-medium">{title}</div>
        <div className="text-3xl font-bold text-neutral mb-2">{value}</div>
        <div className={`btn btn-circle btn-${color} text-xl`} aria-hidden>
          {icon}
        </div>
      </div>
    </div>
  );
}

function DiaristaList({ title, data, color, empty }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-400 mb-2">{title}</div>
      {Object.keys(data).length ? (
        <ul className="divide-y divide-gray-100">
          {Object.entries(data).map(([nome, locais]) => (
            <li key={nome} className="flex items-center justify-between py-2">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full w-8 h-8 flex items-center justify-center ${
                    color === "blue"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span className="text-sm font-medium">{nome.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-neutral">{nome}</p>
                  <p className="text-xs text-gray-500">
  {locais.map((txt) => txt.split("–")[1]?.trim() || txt).join(" | ")}
</p>

                </div>
              </div>
              <span
                className={`badge ${
                  color === "blue" ? "badge-success" : "badge-warning"
                }`}
              >
                {color === "blue" ? "Ativa" : "Agendada"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm text-center py-2">{empty}</p>
      )}
    </div>
  );
}

function CalendarCard({ title, events, emptyText }) {
  return (
    <div className="card bg-white shadow-xl rounded-2xl border border-gray-100">
      <div className="card-body px-6">
        <h2 className="card-title text-lg font-semibold text-neutral mb-2">
          {title}
        </h2>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="pt-br"
          events={events}
          height={500}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
          eventContent={(arg) => (
  <div
    className={`px-2 py-1 rounded-lg text-xs font-medium truncate`}
    style={{
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      border: "1px solid",
      borderColor:
        arg.event.title === "Sem diarista" ? "#fca5a5" : "#93c5fd",
      backgroundColor:
        arg.event.title === "Sem diarista" ? "#fee2e2" : "#dbeafe",
      color:
        arg.event.title === "Sem diarista" ? "#b91c1c" : "#1e3a8a",
    }}
    title={arg.event.title}
  >
    {arg.event.title}
  </div>
)}

          eventClick={(info) => {
            const detalhes = info.event.extendedProps.details?.join("\n") || "Sem detalhes";
            alert(`📋 ${info.event.title}\n\n${detalhes}`);
          }}
        />
        {!events?.length && (
          <p className="text-gray-400 text-sm text-center py-4">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

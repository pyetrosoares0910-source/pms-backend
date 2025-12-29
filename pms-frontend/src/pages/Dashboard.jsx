import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Sparkles, ClipboardList } from "lucide-react";
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
  LabelList,
} from "recharts";
import dayjs from "dayjs";
import { useApi } from "../lib/api";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import minMax from "dayjs/plugin/minMax";
import utc from "dayjs/plugin/utc";
import isBetween from "dayjs/plugin/isBetween";
import DashboardKPIGrid from "../components/DashboardKPIGrid";
import KpiGaugeOcupacao from "../components/KpiGaugeOcupacao";
import KpiMaintenanceProgress from "../components/KpiMaintenanceProgress";
import KpiTotalReservas from "../components/KpiTotalReservas";
import { useTheme } from "../context/ThemeContext";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(minMax);
dayjs.extend(utc);
dayjs.extend(isBetween);

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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stays, setStays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksMonth, setTasksMonth] = useState([]);
  const [maids, setMaids] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [tasksMonthPrev, setTasksMonthPrev] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const startWeek = dayjs().startOf("week").format("YYYY-MM-DD");
        const endWeek = dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD");

        const startMonth = dayjs().startOf("month").format("YYYY-MM-DD");
        const endMonth = dayjs().endOf("month").format("YYYY-MM-DD");

        const prevMonthStart = dayjs()
          .subtract(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD");
        const prevMonthEnd = dayjs()
          .subtract(1, "month")
          .endOf("month")
          .format("YYYY-MM-DD");

        const [
          rsv,
          rms,
          sts,
          checkoutsWeek,
          maidsRes,
          maint,
          checkoutsMonth,
          checkoutsPrevMonth,
        ] = await Promise.all([
          api("/reservations"),
          api("/rooms"),
          api("/stays"),
          api(`/tasks/checkouts?start=${startWeek}&end=${endWeek}`),
          api("/maids"),
          api("/maintenance"),
          api(`/tasks/checkouts?start=${startMonth}&end=${endMonth}`),
          api(`/tasks/checkouts?start=${prevMonthStart}&end=${prevMonthEnd}`),
        ]);

        if (!isMounted) return;

        const mappedWeek = (checkoutsWeek || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        const mappedMonth = (checkoutsMonth || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        const mappedPrevMonth = (checkoutsPrevMonth || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        setReservations(rsv || []);
        setRooms(rms || []);
        setStays(sts || []);
        setTasks(mappedWeek);
        setTasksMonth(mappedMonth);
        setTasksMonthPrev(mappedPrevMonth);
        setMaids(maidsRes || []);
        setMaintenance(maint || []);
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [api]);

  const todayLocal = dayjs().startOf("day");
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

  // === Ocupação geral do mês atual ===
  const ocupacaoGeral = useMemo(() => {
    const { start, end, daysInMonth } = monthBounds();

    const totalNoites = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return sum + overlapDays(r.checkinDate, r.checkoutDate, start, end);
    }, 0);

    const capacidadeTotal = rooms.length * daysInMonth;

    return capacidadeTotal > 0
      ? Math.round((totalNoites / capacidadeTotal) * 100)
      : 0;
  }, [reservations, rooms]);

  // === Ocupação geral do mês anterior ===
  const ocupacaoGeralPrev = useMemo(() => {
    const { start, end, daysInMonth } = monthBounds(
      dayjs().subtract(1, "month")
    );

    const totalNoites = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return sum + overlapDays(r.checkinDate, r.checkoutDate, start, end);
    }, 0);

    const capacidadeTotal = rooms.length * daysInMonth;

    return capacidadeTotal > 0
      ? Math.round((totalNoites / capacidadeTotal) * 100)
      : 0;
  }, [reservations, rooms]);

  // === Ocupação geral do mês retrasado (M-2) ===

  const ocupacaoGeralPrev2 = useMemo(() => {
    const { start, end, daysInMonth } = monthBounds(dayjs().subtract(2, "month"));
    const totalNoites = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return sum + overlapDays(r.checkinDate, r.checkoutDate, start, end);
    }, 0);

    const capacidadeTotal = rooms.length * daysInMonth;
    return capacidadeTotal > 0 ? Math.round((totalNoites / capacidadeTotal) * 100) : 0;
  }, [reservations, rooms]);

  // labels dos meses
  const monthsTrend = useMemo(() => {
    const m2 = dayjs().subtract(2, "month").format("MMM").toUpperCase();
    const m1 = dayjs().subtract(1, "month").format("MMM").toUpperCase();
    const m0 = dayjs().format("MMM").toUpperCase();

    return [
      { label: m2, value: ocupacaoGeralPrev2 },
      { label: m1, value: ocupacaoGeralPrev },
      { label: m0, value: ocupacaoGeral },
    ];
  }, [ocupacaoGeralPrev2, ocupacaoGeralPrev, ocupacaoGeral]);



  // === KPIs principais ===
  const kpis = useMemo(() => {
    const { start: mStart, end: mEnd } = monthBounds();
    const { start: prevStart, end: prevEnd } = monthBounds(
      dayjs().subtract(1, "month")
    );

    const activeToday = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSameOrBefore(todayLocal) &&
        dayjs.utc(r.checkoutDate).isAfter(todayLocal)
    ).length;

    const checkinsToday = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSame(todayLocal, "day")
    ).length;

    const checkoutsToday = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkoutDate).isSame(todayLocal, "day")
    ).length;

    const nightsInMonth = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return sum + overlapDays(r.checkinDate, r.checkoutDate, mStart, mEnd);
    }, 0);

    const totalReservas = reservations.length;

    const reservasMes = reservations.filter((r) => {
      if (!r.checkinDate || !r.checkoutDate) return false;
      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        r.status !== "cancelada" &&
        (ci.isBetween(mStart, mEnd, null, "[]") ||
          co.isBetween(mStart, mEnd, null, "[]"))
      );
    }).length;

    const checkoutsDoMes = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs(r.checkoutDate).isBetween(mStart, mEnd, null, "[]")
    ).length;

    const diariasLimpeza = (() => {
      const set = new Set();
      (tasksMonth || []).forEach((t) => {
        if (!t.maid && !t.maidId) return;
        const key = `${t.date}-${t.maidId || t.maid}`;
        set.add(key);
      });
      return set.size;
    })();

    const diariasLimpezaMes = diariasLimpeza;

    const eficienciaLimpeza =
      diariasLimpeza > 0 ? (checkoutsDoMes / diariasLimpeza).toFixed(1) : "-";

    const mediaDiariasReserva =
      reservasMes > 0 ? (nightsInMonth / reservasMes).toFixed(1) : "-";

    const maiorOcupacao =
      occupancy.rows?.length > 0
        ? occupancy.rows.reduce((a, b) => (a.ocupacao > b.ocupacao ? a : b))
        : null;

    const menorOcupacao =
      occupancy.rows?.length > 0
        ? occupancy.rows.reduce((a, b) => (a.ocupacao < b.ocupacao ? a : b))
        : null;

    const nightsPrev = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return (
        sum + overlapDays(r.checkinDate, r.checkoutDate, prevStart, prevEnd)
      );
    }, 0);

    const reservasPrev = reservations.filter((r) => {
      if (r.status === "cancelada") return false;
      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        ci.isBetween(prevStart, prevEnd, null, "[]") ||
        co.isBetween(prevStart, prevEnd, null, "[]")
      );
    }).length;

    const mediaPrev =
      reservasPrev > 0 ? (nightsPrev / reservasPrev).toFixed(1) : null;

    const checkoutsPrev = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs(r.checkoutDate).isBetween(prevStart, prevEnd, null, "[]")
    ).length;

    const diariasLimpezaPrev = (() => {
      const set = new Set();
      (tasksMonthPrev || []).forEach((t) => {
        if (!t.maid && !t.maidId) return;
        const key = `${t.date}-${t.maidId || t.maid}`;
        set.add(key);
      });
      return set.size;
    })();

    const eficienciaLimpezaPrev =
      diariasLimpezaPrev > 0
        ? (checkoutsPrev / diariasLimpezaPrev).toFixed(1)
        : null;

    const prev = {
      nightsInMonth: nightsPrev,
      reservasMes: reservasPrev,
      mediaDiariasReserva: mediaPrev,
      diariasLimpeza: diariasLimpezaPrev,
      eficienciaLimpeza: eficienciaLimpezaPrev,
    };

    const allEfficiency = (() => {
      const roomMap = {};

      reservations.forEach((r) => {
        if (r.status === "cancelada") return;

        const overlap = overlapDays(
          r.checkinDate,
          r.checkoutDate,
          mStart,
          mEnd
        );
        if (overlap <= 0) return;

        if (!roomMap[r.roomId]) {
          roomMap[r.roomId] = {
            roomId: r.roomId,
            noites: 0,
            capacidade: daysInMonth,
          };
        }

        roomMap[r.roomId].noites += overlap;
      });

      return rooms.map((room) => {
        const data = roomMap[room.id] || {
          noites: 0,
          capacidade: daysInMonth,
        };
        return {
          roomId: room.id,
          label: room?.title || room?.name || `Quarto ${room.id}`,
          image: room?.imageUrl || room?.image || "/placeholder.jpg",
          ocupacao: Math.min(
            100,
            Math.round((data.noites / data.capacidade) * 100)
          ),
        };
      });
    })();

    const topEfficiency = allEfficiency
      .slice()
      .sort((a, b) => b.ocupacao - a.ocupacao)
      .slice(0, 10);

    const worstEfficiency = allEfficiency
      .slice()
      .sort((a, b) => a.ocupacao - b.ocupacao)
      .slice(0, 10);

    return {
      activeToday,
      checkinsToday,
      checkoutsToday,
      nightsInMonth,
      reservasMes,
      totalReservas,
      eficienciaLimpeza,
      mediaDiariasReserva,
      maiorOcupacao,
      menorOcupacao,
      diariasLimpeza,
      topEfficiency,
      checkoutsDoMes,
      diariasLimpezaMes,
      worstEfficiency,
      allEfficiency,
      prev,
    };
  }, [
    reservations,
    occupancy.rows,
    tasksMonth,
    tasksMonthPrev,
    rooms,
    todayLocal,
    daysInMonth,
  ]);

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
      (maintenance || []).map((t) => {
        let raw = t.dueDate || t.createdAt;

        if (typeof raw === "string" && raw.endsWith("Z")) {
          raw = raw.slice(0, -1);
        }

        const date = new Date(raw);
        date.setHours(12, 0, 0, 0);

        return {
          id: t.id,
          title: `${t.title}${t.responsible ? " – " + t.responsible : ""}`,
          start: date,
          allDay: true,
        };
      }),
    [maintenance]
  );

  const topEfficiency = Array.isArray(kpis?.topEfficiency)
    ? kpis.topEfficiency
    : [];

  const worstEfficiency = Array.isArray(kpis?.worstEfficiency)
    ? kpis.worstEfficiency
    : [];

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

  return (
    <div className="p-6 space-y-8 min-h-screen bg-base-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-50">
        Dashboard
      </h1>

      {/* ==== LINHA SUPERIOR: 10 KPI CARDS ==== */}
      <div>
        <DashboardKPIGrid kpis={kpis} />
      </div>

      {/* ==== LINHA: OCUPAÇÃO + MANUTENÇÃO + TOTAL ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        <div className="lg:col-span-2 h-full">
          <KpiGaugeOcupacao data={monthsTrend} />
        </div>

        <div className="lg:col-span-1 h-full">
          <KpiMaintenanceProgress maintenanceStats={maintenanceStats} isDark={isDark} />
        </div>

        <div className="lg:col-span-1 h-full">
          <KpiTotalReservas value={kpis.totalReservas + 1963} note="Inclui 1.963 reservas do PMS anterior" />
        </div>


      </div>


      {/* ==== TOP EFICIÊNCIAS (MELHOR + PIOR) ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Melhor Eficiência */}
        <div className="
  relative card flex-1 flex flex-col
  rounded-3xl border
  bg-gradient-to-br
  from-white via-slate-50 to-white
  dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
  border-slate-200 dark:border-slate-700/60
  shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
  transition-colors duration-300
  overflow-hidden
">

          {/* glow overlay premium */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/12" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-400/12" />
          </div>

          <h2 className="font-semibold text-lg tracking-tight mt-6 mb-2 ml-[30%] text-slate-900 dark:text-slate-100 relative">
            📊 Acomodações com Melhor Eficiência
          </h2>

          <div className="card-body px-6 pb-6 flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Top 3 visual */}
            <div className="flex flex-col items-center justify-center gap-4 w-full lg:w-[30%]">
              {topEfficiency.slice(0, 3).map((item, i) => {
                const colors = [
                  "from-yellow-400 to-yellow-300",
                  "from-gray-300 to-gray-200",
                  "from-amber-700 to-amber-600",
                ];
                const numColor =
                  i === 0
                    ? "text-yellow-500"
                    : i === 1
                      ? "text-gray-400"
                      : "text-amber-700";

                const height = i === 0 ? "h-24" : "h-20";
                const width = "w-40";
                const radius = "rounded-3xl";

                return (
                  <div key={i} className="relative flex flex-col items-center">
                    <div
                      className={`relative bg-gradient-to-br ${colors[i]} p-[3px] shadow-md ${radius} overflow-hidden`}
                    >
                      <div className="absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                      <div
                        className={`
                    bg-white ${height} ${width} ${radius}
                    overflow-hidden flex items-center justify-center
                    dark:bg-slate-950
                  `}
                      >
                        <img
                          src={item.image || "/placeholder.jpg"}
                          alt={item.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <span className={`text-xs font-bold ${numColor}`}>{i + 1}º</span>
                  </div>
                );
              })}
            </div>

            {/* Gráfico Top 10 */}
            <div className="flex-grow w-full lg:w-[70%] flex items-center justify-start">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={topEfficiency.map((item, index) => ({
                    ...item,
                    posicao: `${index + 1}º`,
                  }))}
                  layout="vertical"
                  barCategoryGap={4}
                  margin={{ top: 5, right: 25, left: 10, bottom: 0 }}
                >
                  {/* ✅ defs p/ gradiente premium */}
                  <defs>
                    <linearGradient id="bestGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="55%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>

                    <filter id="bestGlow" x="-30%" y="-40%" width="160%" height="190%">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={{
                      stroke: isDark ? "#4b5563" : "#e5e7eb",
                      strokeDasharray: "3 3",
                    }}
                    tickLine={false}
                    tick={{
                      fill: isDark ? "#9ca3af" : "#6b7280",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="posicao"
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tick={{
                      fill: isDark ? "#e5e7eb" : "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <RechartsTooltip
                    formatter={(v) => `${v}%`}
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                  />

                  <Bar
                    dataKey="ocupacao"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    isAnimationActive={false}
                  >
                    {topEfficiency.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="url(#bestGrad)"
                        filter="url(#bestGlow)"
                      />
                    ))}

                    <LabelList
                      dataKey="label"
                      position="insideLeft"
                      style={{
                        fill: "rgba(255,255,255,0.92)",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                    <LabelList
                      dataKey="ocupacao"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{
                        fill: isDark ? "#e5e7eb" : "#0f172a",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pior Eficiência */}

        <div className="
  relative card flex-1 flex flex-col
  rounded-3xl border
  bg-gradient-to-br
  from-white via-slate-50 to-white
  dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
  border-slate-200 dark:border-slate-700/60
  shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
  transition-colors duration-300
  overflow-hidden
">

          {/* glow overlay premium (negativo sutil) */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl dark:bg-rose-400/12" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-red-500/10 blur-3xl dark:bg-red-400/12" />
          </div>

          <h2 className="font-semibold text-lg tracking-tight mt-6 mb-2 ml-[30%] text-slate-900 dark:text-slate-100 relative">
            📉 Acomodações com Pior Eficiência
          </h2>

          <div className="card-body px-6 pb-6 flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Piores 3 visual */}
            <div className="flex flex-col items-center justify-center gap-4 w-full lg:w-[30%]">
              {worstEfficiency.slice(0, 3).map((item, i) => {
                const colors = [
                  "from-rose-600 to-red-500",
                  "from-rose-600 to-red-500",
                  "from-rose-600 to-red-500",
                ];
                const numColor =
                  i === 0
                    ? "text-rose-500"
                    : i === 1
                      ? "text-red-400"
                      : "text-red-400";

                const height = i === 0 ? "h-24" : "h-20";
                const width = "w-40";
                const radius = "rounded-3xl";

                return (
                  <div key={i} className="relative flex flex-col items-center">
                    <div
                      className={`relative bg-gradient-to-br ${colors[i]} p-[3px] shadow-md ${radius} overflow-hidden`}
                    >
                      <div className="absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <div
                        className={`
                    ${height} ${width} ${radius} overflow-hidden
                    flex items-center justify-center
                    bg-white dark:bg-slate-950
                  `}
                      >
                        <img
                          src={item.image || "/placeholder.jpg"}
                          alt={item.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <span className={`text-xs font-bold ${numColor}`}>{i + 1}º</span>
                  </div>
                );
              })}
            </div>

            {/* Gráfico Top 10 Piores */}
            <div className="flex-grow w-full lg:w-[70%] flex items-center justify-start">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={worstEfficiency.map((item, index) => ({
                    ...item,
                    posicao: `${index + 1}º`,
                  }))}
                  layout="vertical"
                  barCategoryGap={4}
                  margin={{ top: 5, right: 25, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="worstGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="55%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#b91c1c" />
                    </linearGradient>

                    <filter id="worstGlow" x="-30%" y="-40%" width="160%" height="190%">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <XAxis
                    type="number"
                    domain={[0, 75]}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={{
                      stroke: isDark ? "#4b5563" : "#e5e7eb",
                      strokeDasharray: "3 3",
                    }}
                    tickLine={false}
                    tick={{
                      fill: isDark ? "#9ca3af" : "#6b7280",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="posicao"
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tick={{
                      fill: isDark ? "#e5e7eb" : "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <RechartsTooltip
                    formatter={(v) => `${v}%`}
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                  />

                  <Bar
                    dataKey="ocupacao"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    isAnimationActive={false}
                  >
                    {worstEfficiency.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="url(#worstGrad)"
                        filter="url(#worstGlow)"
                      />
                    ))}
                    <LabelList
                      dataKey="label"
                      position="insideLeft"
                      style={{
                        fill: "rgba(255,255,255,0.92)",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                    <LabelList
                      dataKey="ocupacao"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{
                        fill: isDark ? "#fecaca" : "#7f1d1d",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>


      {/* ==== OCUPAÇÃO + DIARISTAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocupação por empreendimento */}
        <div
          className="
    relative lg:col-span-2 overflow-hidden
    rounded-3xl border p-6
    bg-gradient-to-br
    from-white via-slate-50 to-white
    dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
    border-slate-200 dark:border-slate-700/60
    shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
    transition-colors duration-300
  "
        >
          {/* Glow de fundo (sutil, mesmo padrão dos outros) */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            📈 Ocupação por empreendimento{" "}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              (média geral: {occupancy.avg}%)
            </span>
          </h2>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={occupancy.rows}
              barSize={52}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <defs>
                {/* Gradiente principal (mesmo do resto do dash) */}
                <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>

                {/* Glow suave */}
                <filter id="occGlow" x="-30%" y="-40%" width="160%" height="190%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* eixo X */}
              <XAxis
                dataKey="label"
                interval={0}
                tickMargin={10}
                tick={{
                  fill: isDark ? "#e5e7eb" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
              />

              {/* eixo Y */}
              <YAxis
                domain={[0, 100]}
                type="number"
                allowDecimals={false}
                tickFormatter={(v) => `${v}%`}
                tick={{
                  fill: isDark ? "#9ca3af" : "#64748b",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              <RechartsTooltip
                formatter={(v) => `${v}%`}
                labelFormatter={(l, p) => p?.[0]?.payload?.name || l}
                contentStyle={{
                  backgroundColor: isDark ? "#020617" : "#ffffff",
                  borderRadius: "10px",
                  border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                  color: isDark ? "#e5e7eb" : "#0f172a",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                }}
              />

              <Bar
                dataKey="ocupacao"
                name="Ocupação (%)"
                radius={[8, 8, 0, 0]}
                fill="url(#occGrad)"
                filter="url(#occGlow)"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>


        {/* Diaristas */}
        <div
          className="
    relative overflow-hidden
    rounded-3xl border p-6
    bg-gradient-to-br
    from-white via-slate-50 to-white
    dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
    border-slate-200 dark:border-slate-700/60
    shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
    transition-colors duration-300
  "
        >
          {/* Glow sutil */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            👥 Diaristas
          </h2>

          <DiaristaList
            title="Ativas hoje"
            data={maidsToday}
            variant="active"
            empty="Nenhuma diarista ativa hoje"
          />

          <div className="my-4 h-px bg-slate-200/70 dark:bg-slate-700/60" />

          <DiaristaList
            title="Confirmadas para amanhã"
            data={maidsTomorrow}
            variant="scheduled"
            empty="Nenhuma diarista confirmada amanhã"
          />
        </div>

      </div>

      {/* ==== AGENDAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalendarCard
          title="Cronograma de Limpeza"
          icon={Sparkles}
          events={cleaningEvents}
          emptyText="Sem diaristas programadas"
        />
        <CalendarCard
          title="Cronograma de Atividades"
          icon={ClipboardList}
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
function DiaristaList({ title, data, variant, empty }) {
  const isActive = variant === "active";

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        {title}
      </div>

      {Object.keys(data).length ? (
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
          {Object.entries(data).map(([nome, locais]) => {
            const initial = (nome?.trim()?.charAt(0) || "?").toUpperCase();

            const locaisFmt = locais
              .map((txt) => txt.split("–")[1]?.trim() || txt)
              .join(" | ");

            return (
              <li key={nome} className="flex items-center justify-between py-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Avatar premium */}
                  <div
                    className={`
                      h-9 w-9 shrink-0 rounded-full grid place-items-center
                      ring-1
                      ${isActive
                        ? "bg-sky-500/10 ring-sky-400/30 text-sky-700 dark:text-sky-200"
                        : "bg-violet-500/10 ring-violet-400/30 text-violet-700 dark:text-violet-200"
                      }
                    `}
                  >
                    <span className="text-sm font-semibold">{initial}</span>
                  </div>

                  {/* Texto */}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {nome}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {locaisFmt}
                    </p>
                  </div>
                </div>

                {/* Chip premium */}
                <span
                  className={`
                    ml-3 shrink-0
                    inline-flex items-center gap-1.5
                    rounded-full border px-2.5 py-1 text-xs font-semibold
                    backdrop-blur
                    ${isActive
                      ? "text-sky-700 border-sky-300/50 bg-sky-200/20 dark:text-sky-200 dark:border-sky-500/30 dark:bg-sky-500/10"
                      : "text-violet-700 border-violet-300/50 bg-violet-200/20 dark:text-violet-200 dark:border-violet-500/30 dark:bg-violet-500/10"
                    }
                  `}
                >
                  <span
                    className={`
                      h-1.5 w-1.5 rounded-full
                      ${isActive ? "bg-sky-500" : "bg-violet-500"}
                    `}
                  />
                  {isActive ? "Ativa" : "Agendada"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-2">
          {empty}
        </p>
      )}
    </div>
  );
}


function CalendarCard({ title, events, emptyText, icon: Icon }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="
        relative overflow-hidden
        rounded-3xl border p-6
        bg-gradient-to-br
        from-white via-slate-50 to-white
        dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
        border-slate-200 dark:border-slate-700/60
        shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
        transition-colors duration-300
      "
    >
      {/* Glow sutil de fundo */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className="
                h-10 w-10 rounded-xl flex items-center justify-center
                bg-gradient-to-br from-sky-400/20 to-violet-400/20
                ring-1 ring-slate-300/40
                dark:ring-slate-700/60
                text-sky-700 dark:text-sky-300
              "
            >
              <Icon size={18} />
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visão semanal com todas as escalas do dia
            </p>
          </div>
        </div>

        {/* Badge lateral */}
        <div
          className="
            hidden md:flex items-center gap-2
            text-xs rounded-full px-3 py-1 border
            bg-slate-50 border-slate-200 text-slate-600
            dark:bg-slate-900/70 dark:border-slate-700 dark:text-slate-300
          "
        >
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>Eventos confirmados</span>
        </div>
      </div>

      {/* CALENDÁRIO */}
      <div
        className="
          rounded-2xl overflow-hidden border
          bg-white border-slate-200
          dark:bg-slate-950 dark:border-slate-800
        "
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridWeek"
          locale="pt-br"
          events={events}
          height={480}
          dayMaxEvents={false}
          fixedWeekCount={false}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
          }}
          viewDidMount={(arg) => {
            const toolbar = arg.el.querySelector(".fc-header-toolbar");
            if (!toolbar) return;

            const titleEl = toolbar.querySelector(".fc-toolbar-title");
            if (titleEl) {
              titleEl.classList.add(
                "text-sm",
                "font-semibold",
                isDark ? "text-slate-100" : "text-slate-800"
              );
            }

            toolbar.querySelectorAll("button").forEach((btn) => {
              btn.classList.add(
                "rounded-lg",
                "px-3",
                "py-1.5",
                "text-xs",
                "font-medium",
                "transition-all",
                "border",
                "focus:outline-none",
                "focus:ring-2"
              );

              if (isDark) {
                btn.classList.add(
                  "bg-slate-900",
                  "border-slate-700",
                  "text-slate-100",
                  "hover:bg-slate-800"
                );
              } else {
                btn.classList.add(
                  "bg-slate-50",
                  "border-slate-300",
                  "text-slate-800",
                  "hover:bg-slate-100"
                );
              }
            });
          }}
          dayHeaderClassNames={() =>
            isDark
              ? "bg-slate-900 text-slate-300 text-xs border-b border-slate-800"
              : "bg-slate-50 text-slate-600 text-xs border-b border-slate-200"
          }
          dayCellClassNames={() =>
            "text-xs " +
            (isDark
              ? "border-slate-900 hover:bg-slate-900/60"
              : "border-slate-100 hover:bg-slate-50")
          }
          eventClassNames={() => "border-0"}
          eventContent={(arg) => {
            const isNoMaid =
              arg.event.title === "Sem diarista" || arg.event.extendedProps?.tipo === "sem_diarista";


            const base =
              "px-2 py-1 rounded-md text-[11px] font-semibold shadow-sm truncate";

            const style = isDark
              ? isNoEvent
                ? {
                  background:
                    "linear-gradient(135deg,#7f1d1d,#b91c1c)",
                  color: "#fee2e2",
                }
                : {
                  background:
                    "linear-gradient(135deg,#1d4ed8,#38bdf8)",
                  color: "#ecfeff",
                }
              : isNoEvent
                ? {
                  background:
                    "linear-gradient(135deg,#fee2e2,#fecaca)",
                  color: "#ea2929ff",
                }
                : {
                  background:
                    "linear-gradient(135deg,#bfdbfe,#60a5fa)",
                  color: "#0f172a",
                };

            return (
              <div
                className={base}
                style={style}
                title={arg.event.title}
              >
                {arg.event.title}
              </div>
            );
          }}
          contentHeight="auto"
          dayHeaderFormat={{ weekday: "short" }}
        />
      </div>

      {!events?.length && (
        <div className="mt-4 text-center text-sm">
          <div
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-full border
              bg-slate-50 border-slate-200 text-slate-500
              dark:bg-slate-900/70 dark:border-slate-700 dark:text-slate-400
            "
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{emptyText}</span>
          </div>
        </div>
      )}
    </div>
  );
}

